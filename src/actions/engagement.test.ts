/**
 * toggleHelpful and postComment, run against an in-memory fake of the record
 * tools so the recounts count real rows.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionContext, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'

type Row = { recordId: string; createdBy: string; data: Record<string, unknown> }
let db: Record<string, Row[]>
let nextId = 0

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
    create: vi.fn(async (c: string, data: Record<string, unknown>) => {
      if (c === 'helpfulVotes' && rows(c).some((r) => r.data.experienceId === data.experienceId && r.data.userId === data.userId)) {
        return fail('Duplicate: experienceId, userId')
      }
      const recordId = `id-${++nextId}`
      rows(c).push({ recordId, createdBy: actingUser, data: { ...data } })
      return ok({ recordId })
    }),
    update: vi.fn(async (c: string, id: string, data: Record<string, unknown>) => {
      const r = rows(c).find((x) => x.recordId === id)
      if (!r) return fail('not found')
      Object.assign(r.data, data)
      return ok({ recordId: id })
    }),
    remove: vi.fn(async (c: string, id: string) => {
      db[c] = rows(c).filter((x) => x.recordId !== id)
      return ok({ recordId: id })
    }),
  }
}

const OWNER = 'owner'
let ownerTools: ReturnType<typeof fakeTools>
vi.mock('../server/record-tools', () => ({ createOwnerRecordTools: () => ownerTools }))
vi.mock('deepspace/worker', () => ({
  resolveAppRole: vi.fn(),
  isAnonymousUserId: (id: string) => id.startsWith('anon'),
}))

const { toggleHelpful, postComment, updateAuthorComment } = await import('./engagement')

const ctx = (userId: string, params: Record<string, unknown>) => {
  const tools = fakeTools(userId)
  return {
    tools,
    context: { userId, params, tools: tools as unknown as ActionTools, env: {} as Env, callerJwt: 'jwt' } as ActionContext<Env>,
  }
}

beforeEach(() => {
  nextId = 0
  ownerTools = fakeTools(OWNER)
  db = {
    experiences: [{ recordId: 'e1', createdBy: OWNER, data: { helpfulCount: 0, commentCount: 0 } }],
    experienceAuthors: [{ recordId: 'a1', createdBy: 'author', data: { experienceId: 'e1' } }],
    users: [
      { recordId: 'sam', createdBy: 'sam', data: { name: 'Sam Rivera' } },
      { recordId: 'noname', createdBy: 'noname', data: {} },
    ],
  }
})

const helpfulCount = () => db.experiences[0].data.helpfulCount
const commentCount = () => db.experiences[0].data.commentCount

describe('toggleHelpful', () => {
  it('adds a vote, then removes it, recounting each time', async () => {
    expect(await toggleHelpful(ctx('sam', { experienceId: 'e1' }).context)).toEqual({
      success: true,
      data: { voted: true, helpfulCount: 1 },
    })
    expect(db.helpfulVotes).toEqual([expect.objectContaining({ createdBy: 'sam', data: { experienceId: 'e1', userId: 'sam' } })])
    expect(helpfulCount()).toBe(1)

    expect(await toggleHelpful(ctx('sam', { experienceId: 'e1' }).context)).toMatchObject({
      data: { voted: false, helpfulCount: 0 },
    })
    expect(helpfulCount()).toBe(0)
  })

  it('counts votes from different people', async () => {
    await toggleHelpful(ctx('sam', { experienceId: 'e1' }).context)
    await toggleHelpful(ctx('alex', { experienceId: 'e1' }).context)
    expect(helpfulCount()).toBe(2)
  })

  it('writes the count as the owner, never as the voter', async () => {
    await toggleHelpful(ctx('sam', { experienceId: 'e1' }).context)
    expect(ownerTools.update).toHaveBeenCalledWith('experiences', 'e1', { helpfulCount: 1 })
  })

  it('refuses the author voting on their own post', async () => {
    expect(await toggleHelpful(ctx('author', { experienceId: 'e1' }).context)).toMatchObject({ code: 'own_post' })
    expect(db.helpfulVotes ?? []).toEqual([])
  })

  it('refuses signed-out visitors, missing ids and missing experiences', async () => {
    expect(await toggleHelpful(ctx('anon-1', { experienceId: 'e1' }).context)).toMatchObject({ code: 'sign_in_required' })
    expect(await toggleHelpful(ctx('sam', {}).context)).toMatchObject({ code: 'invalid_params' })
    expect(await toggleHelpful(ctx('sam', { experienceId: 'nope' }).context)).toMatchObject({ code: 'not_found' })
  })
})

describe('postComment', () => {
  it('posts as the caller with the account name, and recounts', async () => {
    const result = await postComment(ctx('sam', { experienceId: 'e1', body: '  How long was the OA?  ', authorName: 'Fake' }).context)
    expect(result).toMatchObject({ success: true, data: { commentCount: 1 } })
    expect(db.comments[0]).toMatchObject({
      createdBy: 'sam',
      data: { experienceId: 'e1', authorName: 'Sam Rivera', body: 'How long was the OA?', deleted: false },
    })
    expect(commentCount()).toBe(1)
  })

  it('posts a reply to a top-level comment', async () => {
    await postComment(ctx('sam', { experienceId: 'e1', body: 'Question' }).context)
    const parentId = db.comments[0].recordId
    expect(await postComment(ctx('sam', { experienceId: 'e1', body: 'Answer', parentId }).context)).toMatchObject({
      success: true,
      data: { commentCount: 2 },
    })
    expect(db.comments[1].data.parentId).toBe(parentId)
  })

  it('files a reply to a reply under the same top-level comment, remembering who it answers', async () => {
    db.comments = [
      { recordId: 'top', createdBy: 'x', data: { experienceId: 'e1' } },
      { recordId: 'reply', createdBy: 'x', data: { experienceId: 'e1', parentId: 'top' } },
    ]
    await postComment(ctx('sam', { experienceId: 'e1', body: 'Same here', parentId: 'reply' }).context)
    expect(db.comments[2].data).toMatchObject({ parentId: 'top', replyToId: 'reply' })
  })

  it('refuses replies to deleted comments and other experiences’ comments', async () => {
    db.comments = [
      { recordId: 'gone', createdBy: 'x', data: { experienceId: 'e1', deleted: 1 } },
      { recordId: 'elsewhere', createdBy: 'x', data: { experienceId: 'e2' } },
    ]
    const reply = (parentId: string) => postComment(ctx('sam', { experienceId: 'e1', body: 'Hi', parentId }).context)
    expect(await reply('gone')).toMatchObject({ code: 'parent_deleted' })
    expect(await reply('elsewhere')).toMatchObject({ code: 'parent_not_found' })
    expect(await reply('../x')).toMatchObject({ code: 'parent_not_found' })
    expect(db.comments).toHaveLength(2)
  })

  it('posts the author’s comment as "Owner": written as the app, with no name or author id', async () => {
    const result = await postComment(ctx('author', { experienceId: 'e1', body: 'I can answer that' }).context)
    expect(result).toMatchObject({ success: true, data: { commentCount: 1 } })
    expect(db.comments[0]).toMatchObject({ createdBy: OWNER, data: { byAuthor: true, body: 'I can answer that' } })
    expect(db.comments[0].data).not.toHaveProperty('authorName')
  })

  it('refuses empty or too-long bodies, signed-out visitors and accounts without a name', async () => {
    expect(await postComment(ctx('sam', { experienceId: 'e1', body: '   ' }).context)).toMatchObject({ code: 'invalid_params' })
    expect(await postComment(ctx('sam', { experienceId: 'e1', body: 'x'.repeat(1001) }).context)).toMatchObject({
      code: 'invalid_params',
    })
    expect(await postComment(ctx('anon-1', { experienceId: 'e1', body: 'Hi' }).context)).toMatchObject({
      code: 'sign_in_required',
    })
    expect(await postComment(ctx('noname', { experienceId: 'e1', body: 'Hi' }).context)).toMatchObject({ code: 'no_name' })
    expect(db.comments ?? []).toEqual([])
  })
})

describe('updateAuthorComment', () => {
  beforeEach(() => {
    db.comments = [
      { recordId: 'oc', createdBy: OWNER, data: { experienceId: 'e1', byAuthor: 1, body: 'Old' } },
      { recordId: 'named', createdBy: 'sam', data: { experienceId: 'e1', authorName: 'Sam Rivera', body: 'Hi' } },
    ]
  })

  it('lets the author edit and soft-delete their Owner comment', async () => {
    expect(await updateAuthorComment(ctx('author', { commentId: 'oc', body: ' New ' }).context)).toMatchObject({ success: true })
    expect(db.comments[0].data.body).toBe('New')
    expect(await updateAuthorComment(ctx('author', { commentId: 'oc', delete: true }).context)).toMatchObject({ success: true })
    expect(db.comments[0].data).toMatchObject({ deleted: true, body: '' })
  })

  it('refuses anyone else, and comments that are not Owner comments', async () => {
    expect(await updateAuthorComment(ctx('sam', { commentId: 'oc', body: 'Hijack' }).context)).toMatchObject({ code: 'forbidden' })
    expect(await updateAuthorComment(ctx('author', { commentId: 'named', body: 'Hijack' }).context)).toMatchObject({
      code: 'forbidden',
    })
    expect(await updateAuthorComment(ctx('anon-1', { commentId: 'oc', delete: true }).context)).toMatchObject({
      code: 'sign_in_required',
    })
    expect(db.comments[0].data.body).toBe('Old')
    expect(db.comments[1].data.body).toBe('Hi')
  })

  it('refuses an empty edit', async () => {
    expect(await updateAuthorComment(ctx('author', { commentId: 'oc', body: '  ' }).context)).toMatchObject({
      code: 'invalid_params',
    })
  })
})
