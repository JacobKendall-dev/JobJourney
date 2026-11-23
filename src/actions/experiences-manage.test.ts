/**
 * createExperience's new company / position path, updateExperience and
 * deleteExperience, run against an in-memory fake of the record tools: a new
 * company or position is added (as the owner) only when the post is shared;
 * only the author edits; the author or an admin deletes, and a delete takes
 * the experience's votes, bookmarks, comments and author row.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionContext, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'

type Row = { recordId: string; createdBy: string; data: Record<string, unknown> }
let db: Record<string, Row[]>
let failCreate: string | null = null

function fakeTools(actingUser: string) {
  const ok = <T,>(data: T) => ({ success: true as const, data })
  const fail = (error: string) => ({ success: false as const, error })
  const rows = (c: string) => (db[c] ??= [])
  const matches = (r: Row, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([k, v]) => (k === 'createdBy' ? r.createdBy : r.data[k]) === v)
  let next = 0
  return {
    create: vi.fn(async (c: string, data: Record<string, unknown>) => {
      if (failCreate === c) return fail('boom')
      const recordId = `${c}-new-${++next}`
      rows(c).push({ recordId, createdBy: actingUser, data: { ...data } })
      return ok({ recordId })
    }),
    get: vi.fn(async (c: string, id: string) => {
      const r = rows(c).find((x) => x.recordId === id)
      return r ? ok({ record: r }) : fail('not found')
    }),
    query: vi.fn(async (c: string, o: { where?: Record<string, unknown>; limit?: number } = {}) => {
      const found = rows(c).filter((r) => matches(r, o.where)).slice(0, o.limit ?? Infinity)
      return ok({ records: found, count: found.length })
    }),
    update: vi.fn(async (c: string, id: string, data: Record<string, unknown>) => {
      const r = rows(c).find((x) => x.recordId === id)
      if (!r) return fail('not found')
      for (const [k, v] of Object.entries(data)) {
        if (v === null) delete r.data[k]
        else r.data[k] = v
      }
      return ok({ recordId: id })
    }),
    remove: vi.fn(async (c: string, id: string) => {
      db[c] = rows(c).filter((x) => x.recordId !== id)
      return ok({ recordId: id })
    }),
    deleteWhere: vi.fn(async (c: string, where: Record<string, unknown>, limit = 100) => {
      const doomed = rows(c).filter((r) => matches(r, where)).slice(0, limit)
      db[c] = rows(c).filter((r) => !doomed.includes(r))
      return ok({ deleted: doomed.length })
    }),
  }
}

const OWNER = 'owner'
let ownerTools: ReturnType<typeof fakeTools>
const roles: Record<string, string> = { boss: 'admin' }
vi.mock('../server/record-tools', () => ({ createOwnerRecordTools: () => ownerTools }))
vi.mock('deepspace/worker', () => ({
  resolveAppRole: vi.fn(async (_env: unknown, id: string) => roles[id] ?? 'member'),
  isAnonymousUserId: (id: string) => id.startsWith('anon'),
}))

const { createExperience, updateExperience, deleteExperience } = await import('./experiences')
const { deleteAccount } = await import('./account')

const ctx = (userId: string, params: Record<string, unknown>, env: Partial<Env> = {}) =>
  ({ userId, params, tools: fakeTools(userId) as unknown as ActionTools, env: env as Env, callerJwt: 'jwt' }) as ActionContext<Env>

const content = {
  appliedMonth: '2026-01',
  noResponse: true,
  interviewStages: 1,
  interviewFormats: ['technical'],
  outcome: 'ghosted',
  advice: 'Follow up after a week.',
  showName: false,
}

beforeEach(() => {
  ownerTools = fakeTools(OWNER)
  failCreate = null
  db = {
    companies: [{ recordId: 'c1', createdBy: 'alex', data: { name: 'Acme', slug: 'acme', industry: 'technology' } }],
    positions: [{ recordId: 'p1', createdBy: 'alex', data: { companyId: 'c1', title: 'Analyst', level: 'entry', category: 'other' } }],
    experiences: [
      {
        recordId: 'e1',
        createdBy: OWNER,
        data: {
          companyId: 'c1',
          positionId: 'p1',
          isAnonymous: 0,
          authorName: 'Sam Rivera',
          appliedMonth: '2025-12',
          workArrangement: 'remote',
          firstResponseDays: 4,
          interviewExperience: 'Two rounds.',
          outcome: 'offer',
          helpfulCount: 3,
          commentCount: 1,
        },
      },
      { recordId: 'e2', createdBy: OWNER, data: { companyId: 'c1', positionId: 'p1' } },
    ],
    experienceAuthors: [
      { recordId: 'a1', createdBy: 'sam', data: { experienceId: 'e1' } },
      { recordId: 'a2', createdBy: 'alex', data: { experienceId: 'e2' } },
    ],
    users: [{ recordId: 'sam', createdBy: 'sam', data: { name: 'Sam Rivera' } }],
    helpfulVotes: [
      { recordId: 'v1', createdBy: 'alex', data: { experienceId: 'e1', userId: 'alex' } },
      { recordId: 'v2', createdBy: 'sam', data: { experienceId: 'e2', userId: 'sam' } },
    ],
    bookmarks: [{ recordId: 'b1', createdBy: 'alex', data: { experienceId: 'e1', userId: 'alex' } }],
    comments: [
      { recordId: 'k1', createdBy: 'alex', data: { experienceId: 'e1', body: 'Hi' } },
      { recordId: 'k2', createdBy: 'alex', data: { experienceId: 'e2', body: 'Hi' } },
    ],
  }
})

const e1 = () => db.experiences.find((e) => e.recordId === 'e1')!.data

describe('createExperience with a new company or position', () => {
  const share = { ...content, appliedMonth: '2026-01' }
  const newCompany = { name: 'Nimbus Labs', industry: 'technology', website: 'nimbus.example' }
  const newPosition = { title: 'Data Intern', level: 'intern', category: 'data' }
  const latest = () => db.experiences[db.experiences.length - 1]

  it('adds both as the owner, only when the post is shared', async () => {
    const result = await createExperience(ctx('sam', { ...share, newCompany, newPosition }))
    expect(result).toMatchObject({ success: true })
    const company = db.companies.find((c) => c.data.slug === 'nimbus-labs')!
    const position = db.positions.find((p) => p.data.title === 'Data Intern')!
    expect(company).toMatchObject({ createdBy: OWNER, data: { website: 'https://nimbus.example/' } })
    expect(company.data).not.toHaveProperty('verified')
    expect(position).toMatchObject({ createdBy: OWNER, data: { companyId: company.recordId } })
    expect(latest()).toMatchObject({ createdBy: OWNER, data: { companyId: company.recordId, positionId: position.recordId } })
    expect(db.experienceAuthors.at(-1)).toMatchObject({ createdBy: 'sam' })
  })

  it('adds a new position to an existing company', async () => {
    expect(await createExperience(ctx('sam', { ...share, companyId: 'c1', newPosition }))).toMatchObject({ success: true })
    expect(db.companies).toHaveLength(1)
    expect(latest().data).toMatchObject({ companyId: 'c1', positionId: db.positions.at(-1)!.recordId })
  })

  it('reuses a "new" company or position that already exists', async () => {
    const result = await createExperience(
      ctx('sam', {
        ...share,
        newCompany: { name: 'ACME', industry: 'technology' },
        newPosition: { title: 'Analyst', level: 'entry', category: 'other' },
      }),
    )
    expect(result).toMatchObject({ success: true, data: { experienceId: latest().recordId } })
    expect(db.experiences).toHaveLength(3)
    expect(db.companies).toHaveLength(1)
    expect(db.positions).toHaveLength(1)
    expect(latest().data).toMatchObject({ companyId: 'c1', positionId: 'p1' })
  })

  it('refuses an existing position with a new company, or an invalid new one, adding nothing', async () => {
    expect(await createExperience(ctx('sam', { ...share, newCompany, positionId: 'p1' }))).toMatchObject({
      code: 'invalid_params',
    })
    expect(
      await createExperience(ctx('sam', { ...share, companyId: 'c1', newPosition: { ...newPosition, level: 'boss' } })),
    ).toMatchObject({ code: 'invalid_params' })
    expect(db.companies).toHaveLength(1)
    expect(db.positions).toHaveLength(1)
    expect(db.experiences).toHaveLength(2)
  })

  it('removes what it added when the experience fails to save', async () => {
    failCreate = 'experiences'
    expect(await createExperience(ctx('sam', { ...share, newCompany, newPosition }))).toMatchObject({ success: false })
    expect(ownerTools.remove).toHaveBeenCalledTimes(2)
    expect(db.companies).toHaveLength(1)
    expect(db.positions).toHaveLength(1)
  })
})

describe('updateExperience', () => {
  it('lets the author edit, as the owner, clearing fields left empty', async () => {
    expect(await updateExperience(ctx('sam', { experienceId: 'e1', ...content }))).toEqual({
      success: true,
      data: { experienceId: 'e1' },
    })
    expect(ownerTools.update).toHaveBeenCalledTimes(1)
    expect(e1()).toMatchObject({ appliedMonth: '2026-01', outcome: 'ghosted', noResponse: true, isAnonymous: true })
    for (const cleared of ['authorName', 'workArrangement', 'firstResponseDays', 'interviewExperience']) {
      expect(e1()).not.toHaveProperty(cleared)
    }
  })

  it('never changes company, position or the counters, whatever is sent', async () => {
    await updateExperience(
      ctx('sam', { experienceId: 'e1', ...content, companyId: 'c9', positionId: 'p9', helpfulCount: 99, authorName: 'X' }),
    )
    expect(e1()).toMatchObject({ companyId: 'c1', positionId: 'p1', helpfulCount: 3, commentCount: 1 })
    expect(e1()).not.toHaveProperty('authorName')
  })

  it('sets the shown name from the account', async () => {
    await updateExperience(ctx('sam', { experienceId: 'e1', ...content, showName: true }))
    expect(e1()).toMatchObject({ isAnonymous: false, authorName: 'Sam Rivera' })
  })

  it('refuses anyone but the author, admins included', async () => {
    expect(await updateExperience(ctx('alex', { experienceId: 'e1', ...content }))).toMatchObject({ code: 'forbidden' })
    expect(await updateExperience(ctx('boss', { experienceId: 'e1', ...content }))).toMatchObject({ code: 'forbidden' })
    expect(await updateExperience(ctx('anon-1', { experienceId: 'e1', ...content }))).toMatchObject({
      code: 'sign_in_required',
    })
    expect(e1().outcome).toBe('offer')
  })

  it('refuses invalid content', async () => {
    expect(await updateExperience(ctx('sam', { experienceId: 'e1', ...content, outcome: 'hired!' }))).toMatchObject({
      code: 'invalid_params',
    })
  })
})

describe('deleteExperience', () => {
  it('lets the author delete, taking votes, bookmarks, comments and the author row with it', async () => {
    expect(await deleteExperience(ctx('sam', { experienceId: 'e1' }))).toMatchObject({ success: true })
    expect(db.experiences.map((e) => e.recordId)).toEqual(['e2'])
    for (const c of ['helpfulVotes', 'bookmarks', 'comments', 'experienceAuthors']) {
      expect(db[c].every((r) => r.data.experienceId !== 'e1')).toBe(true)
    }
    // The other experience's rows are untouched.
    expect(db.helpfulVotes).toHaveLength(1)
    expect(db.comments).toHaveLength(1)
    expect(db.experienceAuthors).toHaveLength(1)
  })

  it('lets an admin delete for moderation', async () => {
    expect(await deleteExperience(ctx('boss', { experienceId: 'e2' }))).toMatchObject({ success: true })
    expect(db.experiences.map((e) => e.recordId)).toEqual(['e1'])
  })

  it('refuses other members and signed-out visitors', async () => {
    expect(await deleteExperience(ctx('alex', { experienceId: 'e1' }))).toMatchObject({ code: 'forbidden' })
    expect(await deleteExperience(ctx('anon-1', { experienceId: 'e1' }))).toMatchObject({ code: 'sign_in_required' })
    expect(db.experiences).toHaveLength(2)
  })

  it('finishes cleaning up when the experience is already gone', async () => {
    db.experiences = db.experiences.filter((e) => e.recordId !== 'e1')
    expect(await deleteExperience(ctx('sam', { experienceId: 'e1' }))).toMatchObject({ success: true })
    expect(db.comments.map((c) => c.recordId)).toEqual(['k2'])
  })
})

describe('deleteAccount', () => {
  beforeEach(() => {
    db.users.push({ recordId: 'alex', createdBy: 'alex', data: { name: 'Alex Kim' } })
    db.comments.push({
      recordId: 'k3',
      createdBy: 'sam',
      data: { experienceId: 'e2', body: 'Thanks!', authorName: 'Sam Rivera' },
    })
    db.experiences.find((e) => e.recordId === 'e2')!.data.helpfulCount = 1
    db.bookmarks.push({ recordId: 'b2', createdBy: 'sam', data: { experienceId: 'e2', userId: 'sam' } })
  })

  it("removes the person's posts, votes, bookmarks, name on comments and profile", async () => {
    expect(await deleteAccount(ctx('sam', { confirm: true }))).toMatchObject({
      success: true,
      data: { experiencesDeleted: 1, commentsCleared: 1 },
    })
    // Their post and everything on it.
    expect(db.experiences.map((e) => e.recordId)).toEqual(['e2'])
    expect(db.comments.some((c) => c.data.experienceId === 'e1')).toBe(false)
    // Their vote on someone else's post, with the count fixed.
    expect(db.helpfulVotes).toHaveLength(0)
    expect(db.experiences[0].data.helpfulCount).toBe(0)
    expect(db.bookmarks.some((b) => b.data.userId === 'sam')).toBe(false)
    // Their comment elsewhere stays as a nameless tombstone.
    expect(db.comments.find((c) => c.recordId === 'k3')!.data).toEqual({ experienceId: 'e2', body: '', deleted: true })
    expect(db.users.map((u) => u.recordId)).toEqual(['alex'])
    // Other people's things are untouched.
    expect(db.experienceAuthors.map((a) => a.recordId)).toEqual(['a2'])
    expect(db.comments.find((c) => c.recordId === 'k2')!.data.body).toBe('Hi')
  })

  it('can be run again', async () => {
    await deleteAccount(ctx('sam', { confirm: true }))
    expect(await deleteAccount(ctx('sam', { confirm: true }))).toMatchObject({
      success: true,
      data: { experiencesDeleted: 0, commentsCleared: 0 },
    })
  })

  it('needs confirmation, a signed-in account, and refuses the app owner', async () => {
    expect(await deleteAccount(ctx('sam', {}))).toMatchObject({ code: 'invalid_params' })
    expect(await deleteAccount(ctx('anon-1', { confirm: true }))).toMatchObject({ code: 'sign_in_required' })
    expect(await deleteAccount(ctx('sam', { confirm: true }, { OWNER_USER_ID: 'sam' }))).toMatchObject({
      code: 'owner_account',
    })
    expect(db.experiences).toHaveLength(2)
    expect(db.users).toHaveLength(2)
  })
})
