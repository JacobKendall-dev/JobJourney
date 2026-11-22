/**
 * Server-side checks in the company actions, with the role lookup mocked and
 * fake record tools. Actions run with record permissions off, so these checks
 * are the only thing standing between a member and an admin-only change.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionContext, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'

const resolveAppRole = vi.fn<(env: unknown, userId: string) => Promise<string>>()
vi.mock('deepspace/worker', () => ({ resolveAppRole: (env: unknown, id: string) => resolveAppRole(env, id) }))

const { deleteCompany, setCompanyVerified } = await import('./companies')
const { seedSampleData, SAMPLE_COMPANIES } = await import('./sample-data')

const ok = <T,>(data: T) => ({ success: true as const, data })
const fail = (error: string) => ({ success: false as const, error })

function makeTools(overrides: Partial<Record<keyof ActionTools, unknown>> = {}) {
  return {
    get: vi.fn().mockResolvedValue(ok({ record: { recordId: 'c1', data: {} } })),
    query: vi.fn().mockResolvedValue(ok({ records: [], count: 0 })),
    create: vi.fn().mockResolvedValue(ok({ recordId: 'new' })),
    update: vi.fn().mockResolvedValue(ok({ recordId: 'c1' })),
    remove: vi.fn().mockResolvedValue(ok({ recordId: 'c1' })),
    deleteWhere: vi.fn().mockResolvedValue(ok({ deleted: 0 })),
    integration: vi.fn(),
    registerUser: vi.fn(),
    ...overrides,
  } as unknown as ActionTools & Record<string, ReturnType<typeof vi.fn>>
}

const ctx = (tools: ActionTools, params: Record<string, unknown> = {}): ActionContext<Env> => ({
  userId: 'user-1',
  params,
  tools,
  env: {} as Env,
  callerJwt: 'jwt',
})

beforeEach(() => {
  resolveAppRole.mockReset()
  resolveAppRole.mockResolvedValue('admin')
})

describe('setCompanyVerified', () => {
  it('refuses non-admins without touching records', async () => {
    resolveAppRole.mockResolvedValue('member')
    const tools = makeTools()
    const result = await setCompanyVerified(ctx(tools, { companyId: 'c1', verified: true }))
    expect(result).toMatchObject({ success: false, code: 'forbidden' })
    expect(tools.update).not.toHaveBeenCalled()
  })

  it('validates params', async () => {
    const tools = makeTools()
    expect(await setCompanyVerified(ctx(tools, { companyId: '../x', verified: true }))).toMatchObject({ success: false })
    expect(await setCompanyVerified(ctx(tools, { companyId: 'c1', verified: 'yes' }))).toMatchObject({ success: false })
    expect(tools.update).not.toHaveBeenCalled()
  })

  it('verifies with the admin as verifiedBy', async () => {
    const tools = makeTools()
    expect(await setCompanyVerified(ctx(tools, { companyId: 'c1', verified: true }))).toMatchObject({ success: true })
    expect(tools.update).toHaveBeenCalledWith('companies', 'c1', { verified: true, verifiedBy: 'user-1' })
  })

  it('unverifying clears who and when', async () => {
    const tools = makeTools()
    await setCompanyVerified(ctx(tools, { companyId: 'c1', verified: false }))
    expect(tools.update).toHaveBeenCalledWith('companies', 'c1', { verified: false, verifiedBy: null, verifiedAt: null })
  })

  it('reports a missing company', async () => {
    const tools = makeTools({ get: vi.fn().mockResolvedValue(fail('not found')) })
    expect(await setCompanyVerified(ctx(tools, { companyId: 'c1', verified: true }))).toMatchObject({ code: 'not_found' })
  })
})

describe('deleteCompany', () => {
  it('refuses non-admins', async () => {
    resolveAppRole.mockResolvedValue('member')
    const tools = makeTools()
    expect(await deleteCompany(ctx(tools, { companyId: 'c1' }))).toMatchObject({ code: 'forbidden' })
    expect(tools.remove).not.toHaveBeenCalled()
  })

  it('refuses while experiences use the company', async () => {
    const tools = makeTools({ query: vi.fn().mockResolvedValue(ok({ records: [{ recordId: 'e1' }], count: 1 })) })
    expect(await deleteCompany(ctx(tools, { companyId: 'c1' }))).toMatchObject({ code: 'has_experiences' })
    expect(tools.query).toHaveBeenCalledWith('experiences', { where: { companyId: 'c1' }, limit: 1 })
    expect(tools.deleteWhere).not.toHaveBeenCalled()
    expect(tools.remove).not.toHaveBeenCalled()
  })

  it('refuses when the experience check fails', async () => {
    const tools = makeTools({ query: vi.fn().mockResolvedValue(fail('boom')) })
    expect(await deleteCompany(ctx(tools, { companyId: 'c1' }))).toMatchObject({ code: 'check_failed' })
    expect(tools.remove).not.toHaveBeenCalled()
  })

  it('drains positions in batches, scoped to the company, then deletes it', async () => {
    const deleteWhere = vi
      .fn()
      .mockResolvedValueOnce(ok({ deleted: 100 }))
      .mockResolvedValueOnce(ok({ deleted: 3 }))
    const tools = makeTools({ deleteWhere })
    expect(await deleteCompany(ctx(tools, { companyId: 'c1' }))).toEqual({
      success: true,
      data: { companyId: 'c1', positionsDeleted: 103 },
    })
    expect(deleteWhere).toHaveBeenCalledTimes(2)
    expect(deleteWhere).toHaveBeenCalledWith('positions', { companyId: 'c1' }, 100)
    expect(tools.remove).toHaveBeenCalledWith('companies', 'c1')
  })
})

describe('seedSampleData', () => {
  it('refuses non-admins', async () => {
    resolveAppRole.mockResolvedValue('member')
    const tools = makeTools()
    expect(await seedSampleData(ctx(tools))).toMatchObject({ code: 'forbidden' })
    expect(tools.create).not.toHaveBeenCalled()
  })

  it('creates every sample company and position on an empty app', async () => {
    const tools = makeTools()
    const positions = SAMPLE_COMPANIES.reduce((n, c) => n + c.positions.length, 0)
    expect(await seedSampleData(ctx(tools))).toEqual({
      success: true,
      data: { companiesCreated: SAMPLE_COMPANIES.length, companiesUpdated: 0, positionsCreated: positions },
    })
  })

  it('skips companies and positions that already exist', async () => {
    const query = vi.fn().mockImplementation((_collection: string, options: { where: { slug: string } }) => {
      const sample = SAMPLE_COMPANIES.find((c) => c.slug === options.where.slug)
      return Promise.resolve(ok({ records: [{ recordId: 'existing', data: { location: sample?.location } }], count: 1 }))
    })
    const tools = makeTools({
      query,
      create: vi.fn().mockResolvedValue(fail('Duplicate: a record with companyId=existing already exists')),
    })
    expect(await seedSampleData(ctx(tools))).toEqual({
      success: true,
      data: { companiesCreated: 0, companiesUpdated: 0, positionsCreated: 0 },
    })
    expect(tools.update).not.toHaveBeenCalled()
  })

  it('moves old samples from Remote/Hybrid/On-site to a headquarters city', async () => {
    const tools = makeTools({
      query: vi.fn().mockResolvedValue(ok({ records: [{ recordId: 'old', data: { location: 'On-site' } }], count: 1 })),
      create: vi.fn().mockResolvedValue(fail('Duplicate: exists')),
    })
    const result = await seedSampleData(ctx(tools))
    expect(result).toMatchObject({ success: true, data: { companiesUpdated: SAMPLE_COMPANIES.length } })
    expect(tools.update).toHaveBeenCalledWith('companies', 'old', { location: 'Austin, TX' })
  })

  it('sample company locations are cities or Remote, never an arrangement', () => {
    for (const company of SAMPLE_COMPANIES) {
      expect(['Hybrid', 'On-site']).not.toContain(company.location)
    }
  })

  it('labels every sample company as sample data', () => {
    for (const company of SAMPLE_COMPANIES) {
      expect(company.name).toMatch(/^(Example|Sample|Demo|Placeholder) /)
    }
  })
})
