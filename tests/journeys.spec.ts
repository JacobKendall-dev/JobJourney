/**
 * Two signed-in people using JobJourney at once: Alice shares, Bob reads,
 * votes and comments. These check the promises one browser can't:
 * anonymity, "Owner" replies, who can change a post, live updates, and the
 * privacy dialog.
 *
 * Each test shares its own post through the createExperience action and
 * deletes it at the end. The company and position have fixed names, so
 * every run reuses them instead of adding new ones.
 *
 * Needs two test accounts (see collab.spec.ts). The paid privacy check is
 * never called: the dialog test answers reviewPrivacy itself.
 */

import type { Page } from '@playwright/test'
import { test, expect, loadAllTestAccounts, type MultiplayerUser } from 'deepspace/testing'

const usable = loadAllTestAccounts().length
test.skip(usable < 2, `Needs 2 usable test accounts, found ${usable}. See collab.spec.ts for how to create them.`)

const PLACE = {
  newCompany: { name: 'Playwright Test Co', industry: 'technology' },
  newPosition: { title: 'Test Engineer', level: 'entry', category: 'software' },
}

type ActionReply<T = Record<string, unknown>> = { success: boolean; data?: T; error?: string; code?: string }

/** Calls a server action as the user signed in on `page`, the way the app does. */
async function callAs<T = Record<string, unknown>>(
  page: Page,
  name: string,
  params: Record<string, unknown>,
): Promise<ActionReply<T>> {
  return page.evaluate(
    async ({ name, params }) => {
      const tokenRes = await fetch('/api/auth/token', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const { token } = await tokenRes.json()
      const res = await fetch(`/api/actions/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(params),
      })
      return res.json()
    },
    { name, params },
  )
}

/** Signs both people in and opens the app, so each has a users row. */
async function aliceAndBob(users: (n: number) => Promise<MultiplayerUser[]>) {
  const [alice, bob] = await users(2)
  await Promise.all([alice.page.goto('/experiences'), bob.page.goto('/experiences')])
  for (const u of [alice, bob]) {
    await expect(u.page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })
  }
  return { alice, bob }
}

/** Alice shares an anonymous post and gets its id. */
async function sharePost(alice: MultiplayerUser, story: string): Promise<string> {
  const month = new Date().toISOString().slice(0, 7)
  const result = await callAs<{ experienceId: string }>(alice.page, 'createExperience', {
    ...PLACE,
    appliedMonth: month,
    noResponse: false,
    firstResponseDays: 5,
    interviewStages: 2,
    interviewFormats: ['phone_screen', 'technical'],
    outcome: 'in_progress',
    interviewExperience: story,
    advice: 'Practise out loud.',
    showName: false,
  })
  expect(result, JSON.stringify(result)).toMatchObject({ success: true })
  return result.data!.experienceId
}

async function removePost(alice: MultiplayerUser, experienceId: string | undefined) {
  if (experienceId) await callAs(alice.page, 'deleteExperience', { experienceId })
}

/** A story text no other run or test will have. */
const uniqueStory = (label: string) => `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

test('an anonymous post never reveals its author to other people', async ({ users }) => {
  const { alice, bob } = await aliceAndBob(users)
  expect(alice.userId, "Alice's user id is in the test account registry").toBeTruthy()

  // Record everything Bob's browser receives over the live connection.
  const frames: string[] = []
  bob.page.on('websocket', (ws) =>
    ws.on('framereceived', (f) => frames.push(typeof f.payload === 'string' ? f.payload : f.payload.toString('latin1'))),
  )

  let id: string | undefined
  try {
    const story = uniqueStory('Anonymity check.')
    id = await sharePost(alice, story)
    await bob.page.goto(`/experiences/${id}`)
    await expect(bob.page.getByText(story)).toBeVisible({ timeout: 15_000 })

    // On screen: shared anonymously, no name.
    await expect(bob.page.getByText('Shared anonymously').first()).toBeVisible()
    await expect(bob.page.getByRole('main').getByText(alice.name)).toHaveCount(0)

    // In the data: the post reached Bob's browser, without Alice's id anywhere in it.
    const aboutPost = frames.filter((f) => f.includes(id!))
    expect(aboutPost.length).toBeGreaterThan(0)
    for (const frame of aboutPost) expect(frame).not.toContain(alice.userId!)
  } finally {
    await removePost(alice, id)
  }
})

test("the author's reply shows as Owner, not their name", async ({ users }) => {
  const { alice, bob } = await aliceAndBob(users)
  let id: string | undefined
  try {
    id = await sharePost(alice, uniqueStory('Owner reply check.'))
    await Promise.all([alice.page.goto(`/experiences/${id}`), bob.page.goto(`/experiences/${id}`)])

    // Bob comments under his own name.
    const question = uniqueStory('How long did the technical round take?')
    await bob.page.getByPlaceholder('Ask a question or add what you know').fill(question)
    await bob.page.getByRole('button', { name: 'Comment', exact: true }).click()
    await expect(bob.page.getByText(question)).toBeVisible({ timeout: 15_000 })

    // Alice sees it arrive live and replies.
    const bobsComment = alice.page.locator('article', { hasText: question })
    await expect(bobsComment).toBeVisible({ timeout: 15_000 })
    await expect(bobsComment.getByText(bob.name)).toBeVisible()
    await bobsComment.getByRole('button', { name: 'Reply' }).click()
    const answer = uniqueStory('About an hour.')
    await alice.page.getByPlaceholder(`Reply to ${bob.name}`).fill(answer)
    await alice.page.locator('form', { has: alice.page.getByPlaceholder(`Reply to ${bob.name}`) })
      .getByRole('button', { name: 'Reply' })
      .click()

    // Bob sees the reply as Owner, and Alice's name appears nowhere on the page.
    const reply = bob.page.locator('article', { hasText: answer })
    await expect(reply).toBeVisible({ timeout: 15_000 })
    await expect(reply.getByText('Owner', { exact: true })).toBeVisible()
    await expect(bob.page.getByRole('main').getByText(alice.name)).toHaveCount(0)
  } finally {
    await removePost(alice, id)
  }
})

test("other people can't edit or delete someone's post", async ({ users }) => {
  const { alice, bob } = await aliceAndBob(users)
  let id: string | undefined
  try {
    const story = uniqueStory('Permissions check.')
    id = await sharePost(alice, story)

    // The author gets Edit and Delete; Bob doesn't.
    await alice.page.goto(`/experiences/${id}`)
    await expect(alice.page.getByText('This is your post.')).toBeVisible({ timeout: 15_000 })
    await bob.page.goto(`/experiences/${id}`)
    await expect(bob.page.getByText(story)).toBeVisible({ timeout: 15_000 })
    const actions = bob.page.getByRole('group', { name: 'Actions' })
    await expect(actions.getByRole('link', { name: 'Edit' })).toHaveCount(0)
    await expect(actions.getByRole('button', { name: /delete/i })).toHaveCount(0)

    // Going around the interface doesn't work either.
    expect(await callAs(bob.page, 'updateExperience', { experienceId: id, interviewExperience: 'Hijacked' })).toMatchObject({
      success: false,
    })
    expect(await callAs(bob.page, 'deleteExperience', { experienceId: id })).toMatchObject({
      success: false,
      code: 'forbidden',
    })

    // The post is unchanged.
    await bob.page.reload()
    await expect(bob.page.getByText(story)).toBeVisible({ timeout: 15_000 })
  } finally {
    await removePost(alice, id)
  }
})

test("a helpful vote shows on the author's page without reloading", async ({ users }) => {
  const { alice, bob } = await aliceAndBob(users)
  let id: string | undefined
  try {
    id = await sharePost(alice, uniqueStory('Live update check.'))
    await Promise.all([alice.page.goto(`/experiences/${id}`), bob.page.goto(`/experiences/${id}`)])
    await expect(alice.page.getByText('0 found this helpful')).toBeVisible({ timeout: 15_000 })

    await bob.page.getByRole('button', { name: 'Helpful (0)' }).click()
    await expect(bob.page.getByRole('button', { name: 'Helpful (1)' })).toHaveAttribute('aria-pressed', 'true', {
      timeout: 15_000,
    })
    await expect(alice.page.getByText('1 found this helpful')).toBeVisible({ timeout: 15_000 })
  } finally {
    await removePost(alice, id)
  }
})

test('the privacy dialog flags details before saving, and Save anyway still saves', async ({ users }) => {
  const { alice } = await aliceAndBob(users)
  let id: string | undefined
  try {
    id = await sharePost(alice, uniqueStory('Privacy dialog check.'))

    // Answer the check here, so no paid call is made.
    let checks = 0
    await alice.page.route('**/api/actions/reviewPrivacy', async (route) => {
      checks += 1
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { checked: true, flags: [{ quote: 'Sarah Lee', reason: 'Named interviewer' }] },
        }),
      })
    })

    await alice.page.goto(`/experiences/${id}/edit`)
    const story = alice.page.locator('#share-interview')
    await expect(story).toBeVisible({ timeout: 15_000 })
    const edited = uniqueStory('My interviewer Sarah Lee was kind.')
    await story.fill(edited)
    await alice.page.getByRole('button', { name: 'Save changes' }).click()

    // The dialog lists the flag. Edit post closes it and returns to the story.
    const dialog = alice.page.getByRole('dialog')
    await expect(dialog.getByText('Check before you share')).toBeVisible()
    await expect(dialog.getByText('Sarah Lee')).toBeVisible()
    await expect(dialog.getByText('Named interviewer')).toBeVisible()
    await dialog.getByRole('button', { name: 'Edit post' }).click()
    await expect(dialog).toBeHidden()
    await expect(story).toBeFocused()

    // Pressing Save again with the same text reuses the result: no second check.
    await alice.page.getByRole('button', { name: 'Save changes' }).click()
    await expect(dialog.getByText('Sarah Lee')).toBeVisible()
    expect(checks).toBe(1)

    // The check only advises: saving anyway saves.
    await dialog.getByRole('button', { name: 'Save changes anyway' }).click()
    await expect(alice.page).toHaveURL(new RegExp(`/experiences/${id}$`), { timeout: 15_000 })
    await expect(alice.page.getByText(edited)).toBeVisible({ timeout: 15_000 })
  } finally {
    await removePost(alice, id)
  }
})
