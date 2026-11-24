/**
 * reviewPrivacy: the paid Claude call is mocked. Checks the model and length
 * cap sent, the daily caps, and that any failure falls back to the free
 * pattern results instead of blocking the post.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionContext, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { fakeStore } from '../server/fake-store.test-helper'
import { PRIVACY_CHECKS_PER_DAY, PRIVACY_CHECKS_PER_USER_DAY, PRIVACY_MODEL } from '../lib/paid-limits'

let store = fakeStore()
vi.mock('../server/record-tools', () => ({ createOwnerRecordTools: () => store.tools }))
vi.mock('deepspace/worker', () => ({ isAnonymousUserId: (id: string) => id.startsWith('anon') }))

const { reviewPrivacy } = await import('./privacy')

const claudeSays = (text: string) => ({ success: true, data: { content: [{ type: 'text', text }] } })
const post = { interviewExperience: 'My interviewer Sarah Lee was kind. Mail me: a@b.com', advice: 'Practise graphs.' }

function run(params: Record<string, unknown>, integration = vi.fn(), userId = 'user-1') {
  const tools = { integration } as unknown as ActionTools
  return reviewPrivacy({ userId, params, tools, env: {} as Env, callerJwt: 'jwt' } as ActionContext<Env>)
}

beforeEach(() => {
  store = fakeStore()
})

describe('reviewPrivacy', () => {
  it('refuses signed-out visitors', async () => {
    const integration = vi.fn()
    expect(await run(post, integration, 'anon-1')).toMatchObject({ success: false, code: 'sign_in_required' })
    expect(integration).not.toHaveBeenCalled()
  })

  it('asks Haiku with a capped reply and merges its flags with the patterns', async () => {
    const integration = vi.fn().mockResolvedValue(claudeSays('[{"quote":"Sarah Lee","reason":"Named interviewer"}]'))
    const result = await run(post, integration)
    expect(integration).toHaveBeenCalledTimes(1)
    const [endpoint, body] = integration.mock.calls[0]
    expect(endpoint).toBe('anthropic/chat-completion')
    expect(body).toMatchObject({ model: PRIVACY_MODEL, max_tokens: 300, temperature: 0 })
    expect(body.messages[0].content).toContain('Sarah Lee')
    expect(result).toEqual({
      success: true,
      data: {
        checked: true,
        flags: [
          { quote: 'a@b.com', reason: 'Email address' },
          { quote: 'Sarah Lee', reason: 'Named interviewer' },
        ],
      },
    })
  })

  it('falls back to the patterns when the call fails, e.g. out of credits', async () => {
    const integration = vi.fn().mockResolvedValue({ success: false, error: 'No credits', code: 'insufficient_credits' })
    expect(await run(post, integration)).toEqual({
      success: true,
      data: { checked: false, flags: [{ quote: 'a@b.com', reason: 'Email address' }] },
    })
  })

  it("doesn't call Claude for empty text", async () => {
    const integration = vi.fn()
    expect(await run({ interviewExperience: '  ' }, integration)).toEqual({ success: true, data: { checked: false, flags: [] } })
    expect(integration).not.toHaveBeenCalled()
  })

  it('stops calling Claude at the per-person cap', async () => {
    const integration = vi.fn().mockResolvedValue(claudeSays('[]'))
    for (let i = 0; i < PRIVACY_CHECKS_PER_USER_DAY; i++) await run(post, integration)
    const over = await run(post, integration)
    expect(integration).toHaveBeenCalledTimes(PRIVACY_CHECKS_PER_USER_DAY)
    expect(over).toMatchObject({ success: true, data: { checked: false } })
    // Someone else still gets checked.
    await run(post, integration, 'user-2')
    expect(integration).toHaveBeenCalledTimes(PRIVACY_CHECKS_PER_USER_DAY + 1)
  })

  it('stops calling Claude at the app-wide cap', async () => {
    const integration = vi.fn().mockResolvedValue(claudeSays('[]'))
    for (let i = 0; i < PRIVACY_CHECKS_PER_DAY + 3; i++) await run(post, integration, `user-${i}`)
    expect(integration).toHaveBeenCalledTimes(PRIVACY_CHECKS_PER_DAY)
  })

  it("stores a hash, not the user's id, in the usage keys", async () => {
    await run(post, vi.fn().mockResolvedValue(claudeSays('[]')), 'user-secret-id')
    const keys = store.rows('dailyUsage').map((r) => String(r.data.key))
    expect(keys).toHaveLength(2)
    expect(keys.join(' ')).not.toContain('user-secret-id')
  })
})
