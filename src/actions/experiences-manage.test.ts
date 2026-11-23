/**
 * updateExperience and deleteExperience, run against an in-memory fake of the
 * record tools: only the author edits; the author or an admin deletes, and
 * a delete takes the experience's votes, bookmarks, comments and author row.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionContext, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'

type Row = { recordId: string; createdBy: string; data: Record<string, unknown> }
let db: Record<string, Row[]>

function fakeTools(actingUser: string) {
  const ok = <T,>(data: T) => ({ success: true as const, data })
  const fail = (error: string) => ({ success: false as const, error })
  const rows = (c: string) => (db[c] ??= [])
  const matches = (r: Row, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([k, v]) => (k === 'createdBy' ? r.createdBy : r.data[k]) === v)
  return {
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

const { updateExperience, deleteExperience } = await import('./experiences')

const ctx = (userId: string, params: Record<string, unknown>) =>
  ({ userId, params, tools: fakeTools(userId) as unknown as ActionTools, env: {} as Env, callerJwt: 'jwt' }) as ActionContext<Env>

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
  db = {
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
