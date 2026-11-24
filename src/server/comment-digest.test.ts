/**
 * The comment digest run, with fake records and a mocked send (the paid
 * email/send call never runs in tests).
 */

import { describe, expect, it, vi } from 'vitest'
import { DIGEST_EMAILS_PER_RUN } from '../lib/paid-limits'
import { runCommentDigest } from './comment-digest'
import { fakeStore } from './fake-store.test-helper'

const now = new Date('2026-11-23T09:00:00.000Z')
const recent = '2026-11-22T15:00:00.000Z'
const appUrl = 'https://jobjourney.app.space'

/** Author `a<i>` wrote experience `e<i>`, which got one new comment. */
function seed(authors: number, prefs: (i: number) => Record<string, unknown> = () => ({ notifyComments: 1 })) {
  const list = Array.from({ length: authors }, (_, i) => i)
  return fakeStore({
    users: list.map((i) => ({ recordId: `a${i}`, data: { email: `a${i}@example.com`, ...prefs(i) } })),
    experienceAuthors: list.map((i) => ({ createdBy: `a${i}`, data: { experienceId: `e${i}` } })),
    experiences: list.map((i) => ({ recordId: `e${i}`, data: { companyId: 'c1', positionId: 'p1' } })),
    companies: [{ recordId: 'c1', data: { name: 'Acme' } }],
    positions: [{ recordId: 'p1', data: { title: 'Engineer' } }],
    comments: list.map((i) => ({ createdAt: recent, createdBy: 'someone', data: { experienceId: `e${i}` } })),
  })
}

describe('runCommentDigest', () => {
  it('emails each opted-in author about their posts', async () => {
    const store = seed(2, (i) => ({ notifyComments: i === 0 ? 1 : 0 }))
    const send = vi.fn().mockResolvedValue(undefined)
    const result = await runCommentDigest({ tools: store.tools, send, appUrl, now })
    expect(result).toEqual({ sent: 1, skipped: 0, failed: false })
    expect(send).toHaveBeenCalledTimes(1)
    const [to, email] = send.mock.calls[0]
    expect(to).toBe('a0@example.com')
    expect(email.subject).toBe('1 new comment on your JobJourney posts')
    expect(email.text).toContain('Engineer at Acme')
    expect(email.text).toContain(`${appUrl}/experiences/e0`)
  })

  it("doesn't email the same comments twice", async () => {
    const store = seed(1)
    const send = vi.fn().mockResolvedValue(undefined)
    await runCommentDigest({ tools: store.tools, send, appUrl, now })
    await runCommentDigest({ tools: store.tools, send, appUrl, now: new Date('2026-11-24T09:00:00.000Z') })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('sends at most the per-run cap', async () => {
    const store = seed(DIGEST_EMAILS_PER_RUN + 2)
    const send = vi.fn().mockResolvedValue(undefined)
    const result = await runCommentDigest({ tools: store.tools, send, appUrl, now })
    expect(send).toHaveBeenCalledTimes(DIGEST_EMAILS_PER_RUN)
    expect(result).toEqual({ sent: DIGEST_EMAILS_PER_RUN, skipped: 2, failed: false })
  })

  it('stops after a failed send, e.g. out of credits', async () => {
    const store = seed(3)
    const send = vi.fn().mockRejectedValue(new Error('insufficient_credits'))
    const result = await runCommentDigest({ tools: store.tools, send, appUrl, now })
    expect(send).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ sent: 0, skipped: 3, failed: true })
  })

  it("ignores the author's own comments and deleted ones", async () => {
    const store = fakeStore({
      users: [{ recordId: 'a0', data: { email: 'a0@example.com', notifyComments: 1 } }],
      experienceAuthors: [{ createdBy: 'a0', data: { experienceId: 'e0' } }],
      comments: [
        { createdAt: recent, data: { experienceId: 'e0', byAuthor: 1 } },
        { createdAt: recent, data: { experienceId: 'e0', deleted: 1 } },
      ],
    })
    const send = vi.fn()
    expect(await runCommentDigest({ tools: store.tools, send, appUrl, now })).toEqual({ sent: 0, skipped: 0, failed: false })
    expect(send).not.toHaveBeenCalled()
  })

  it('uses a plain title when the post details are missing', async () => {
    const store = fakeStore({
      users: [{ recordId: 'a0', data: { email: 'a0@example.com', notifyComments: 1 } }],
      experienceAuthors: [{ createdBy: 'a0', data: { experienceId: 'gone' } }],
      comments: [{ createdAt: recent, data: { experienceId: 'gone' } }],
    })
    const send = vi.fn().mockResolvedValue(undefined)
    await runCommentDigest({ tools: store.tools, send, appUrl, now })
    expect(send.mock.calls[0][1].text).toContain('- Your experience: 1 new comment')
  })
})
