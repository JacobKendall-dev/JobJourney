/**
 * createExperience — the anonymity rules, checked with fake record tools:
 * the public experience is written as the OWNER and carries no author id;
 * only the private author row is written as the caller.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionContext, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'

const ownerTools = {
  create: vi.fn(),
  remove: vi.fn(),
  get: vi.fn(),
}
let ownerAvailable = true
vi.mock('../server/record-tools', () => ({
  createOwnerRecordTools: () => (ownerAvailable ? ownerTools : null),
}))
vi.mock('deepspace/worker', () => ({ resolveAppRole: vi.fn() }))

const { createExperience } = await import('./experiences')

const ok = <T,>(data: T) => ({ success: true as const, data })
const fail = (error: string) => ({ success: false as const, error })
const record = (data: Record<string, unknown>) => ok({ record: { recordId: 'x', data } })

const CALLER = 'user-123'

function callerTools(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn((collection: string) => {
      if (collection === 'companies') return Promise.resolve(record({ name: 'Acme' }))
      if (collection === 'positions') return Promise.resolve(record({ companyId: 'c1' }))
      if (collection === 'users') return Promise.resolve(record({ name: '  Sam Rivera  ' }))
      return Promise.resolve(fail('not found'))
    }),
    create: vi.fn().mockResolvedValue(ok({ recordId: 'author-row' })),
    ...overrides,
  } as unknown as ActionTools & Record<string, ReturnType<typeof vi.fn>>
}

const validParams = {
  companyId: 'c1',
  positionId: 'p1',
  appliedMonth: '2026-03',
  workArrangement: 'remote',
  firstResponseDays: 5,
  noResponse: false,
  interviewStages: 2,
  interviewFormats: ['technical', 'phone_screen'],
  outcome: 'offer',
  interviewExperience: 'Two rounds.',
  advice: '',
  showName: false,
}

const ctx = (tools: ActionTools, params: Record<string, unknown> = validParams): ActionContext<Env> => ({
  userId: CALLER,
  params,
  tools,
  env: {} as Env,
  callerJwt: 'jwt',
})

beforeEach(() => {
  ownerAvailable = true
  ownerTools.create.mockReset().mockResolvedValue(ok({ recordId: 'exp-1' }))
  ownerTools.remove.mockReset().mockResolvedValue(ok({ recordId: 'exp-1' }))
})

describe('createExperience', () => {
  it('writes the experience as the owner, and the author row as the caller', async () => {
    const tools = callerTools()
    const result = await createExperience(ctx(tools))

    expect(result).toEqual({ success: true, data: { experienceId: 'exp-1' } })
    expect(ownerTools.create).toHaveBeenCalledTimes(1)
    expect(ownerTools.create.mock.calls[0][0]).toBe('experiences')
    expect(tools.create).toHaveBeenCalledTimes(1)
    expect(tools.create).toHaveBeenCalledWith('experienceAuthors', { experienceId: 'exp-1' })
  })

  it('never puts the caller’s id on the public experience', async () => {
    await createExperience(ctx(callerTools()))
    const data = ownerTools.create.mock.calls[0][1]
    expect(JSON.stringify(data)).not.toContain(CALLER)
    expect(data).not.toHaveProperty('authorName')
    expect(data).toMatchObject({
      isAnonymous: true,
      helpfulCount: 0,
      commentCount: 0,
      interviewFormats: ['phone_screen', 'technical'],
    })
  })

  it('takes the shown name from the account, never from the request', async () => {
    await createExperience(ctx(callerTools(), { ...validParams, showName: true, authorName: 'Someone Else' }))
    const data = ownerTools.create.mock.calls[0][1]
    expect(data).toMatchObject({ isAnonymous: false, authorName: 'Sam Rivera' })
  })

  it('refuses "show my name" when the account has no name', async () => {
    const tools = callerTools({
      get: vi.fn((collection: string) =>
        Promise.resolve(
          collection === 'users' ? record({}) : record(collection === 'positions' ? { companyId: 'c1' } : {}),
        ),
      ),
    })
    expect(await createExperience(ctx(tools, { ...validParams, showName: true }))).toMatchObject({ code: 'no_name' })
    expect(ownerTools.create).not.toHaveBeenCalled()
  })

  it('refuses when the owner identity is unavailable, instead of writing as the caller', async () => {
    ownerAvailable = false
    const tools = callerTools()
    expect(await createExperience(ctx(tools))).toMatchObject({ code: 'owner_unavailable' })
    expect(tools.create).not.toHaveBeenCalled()
  })

  it('validates on the server', async () => {
    const tools = callerTools()
    for (const params of [
      { ...validParams, outcome: 'hired' },
      { ...validParams, appliedMonth: '2999-01' },
      { ...validParams, interviewStages: 11 },
      { ...validParams, firstResponseDays: 5, noResponse: true },
      { ...validParams, interviewExperience: '', advice: '' },
      { ...validParams, advice: 'x'.repeat(2001) },
      { ...validParams, companyId: '../etc' },
    ]) {
      expect(await createExperience(ctx(tools, params))).toMatchObject({ success: false, code: 'invalid_params' })
    }
    expect(ownerTools.create).not.toHaveBeenCalled()
  })

  it('refuses a position from a different company', async () => {
    const tools = callerTools({
      get: vi.fn((collection: string) =>
        Promise.resolve(collection === 'positions' ? record({ companyId: 'other' }) : record({ name: 'Acme' })),
      ),
    })
    expect(await createExperience(ctx(tools))).toMatchObject({ code: 'position_not_found' })
  })

  it('refuses a missing company', async () => {
    const tools = callerTools({ get: vi.fn().mockResolvedValue(fail('not found')) })
    expect(await createExperience(ctx(tools))).toMatchObject({ code: 'company_not_found' })
  })

  it('removes the experience if the author row fails, so no unowned post is left', async () => {
    const tools = callerTools({ create: vi.fn().mockResolvedValue(fail('boom')) })
    expect(await createExperience(ctx(tools))).toMatchObject({ code: 'author_row_failed' })
    expect(ownerTools.remove).toHaveBeenCalledWith('experiences', 'exp-1')
  })
})
