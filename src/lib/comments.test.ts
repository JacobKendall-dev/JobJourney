import { describe, expect, it } from 'vitest'
import {
  buildThread,
  checkCommentBody,
  commentAuthorName,
  commentCountText,
  isDeleted,
  isEdited,
  isOwnComment,
  replyPlacement,
  type CommentRecord,
} from './comments'

const c = (id: string, createdAt: string, data: Partial<CommentRecord['data']> = {}, updatedAt = createdAt): CommentRecord => ({
  recordId: id,
  createdBy: 'u',
  createdAt,
  updatedAt,
  data: { experienceId: 'e1', body: id, ...data },
})

describe('checkCommentBody', () => {
  it('trims and accepts 1–1,000 characters', () => {
    expect(checkCommentBody('  hi  ')).toEqual({ ok: true, body: 'hi' })
    expect(checkCommentBody('x'.repeat(1000))).toMatchObject({ ok: true })
  })

  it('refuses empty, whitespace, too long and non-text', () => {
    expect(checkCommentBody('   ')).toMatchObject({ ok: false })
    expect(checkCommentBody('x'.repeat(1001))).toMatchObject({ ok: false })
    expect(checkCommentBody(42)).toMatchObject({ ok: false })
  })
})

describe('buildThread', () => {
  it('nests replies under their parent, both oldest first', () => {
    const thread = buildThread([
      c('r2', '2026-03-04', { parentId: 'a' }),
      c('b', '2026-03-02'),
      c('a', '2026-03-01'),
      c('r1', '2026-03-03', { parentId: 'a' }),
    ])
    expect(thread.map((t) => t.comment.recordId)).toEqual(['a', 'b'])
    expect(thread[0].replies.map((r) => r.recordId)).toEqual(['r1', 'r2'])
    expect(thread[1].replies).toEqual([])
  })

  it('shows a reply whose parent is missing as top-level instead of losing it', () => {
    expect(buildThread([c('orphan', '2026-03-01', { parentId: 'gone' })]).map((t) => t.comment.recordId)).toEqual([
      'orphan',
    ])
  })
})

describe('isEdited, isDeleted and commentCountText', () => {
  it('marks a comment edited only when updated well after posting', () => {
    expect(isEdited(c('a', '2026-03-01T10:00:00Z', {}, '2026-03-01T10:00:01Z'))).toBe(false)
    expect(isEdited(c('a', '2026-03-01T10:00:00Z', {}, '2026-03-01T10:05:00Z'))).toBe(true)
  })

  it('reads deleted as stored 0 / 1', () => {
    expect(isDeleted(c('a', '', { deleted: 1 }))).toBe(true)
    expect(isDeleted(c('a', '', { deleted: 0 }))).toBe(false)
  })

  it('pluralizes', () => {
    expect(commentCountText(1)).toBe('1 comment')
    expect(commentCountText(0)).toBe('0 comments')
  })
})

describe('replyPlacement', () => {
  it('a reply to a top-level comment joins its thread', () => {
    expect(replyPlacement({ recordId: 'top', data: {} })).toEqual({ parentId: 'top' })
  })

  it('a reply to a reply stays one level deep and remembers who it answers', () => {
    expect(replyPlacement({ recordId: 'r1', data: { parentId: 'top' } })).toEqual({ parentId: 'top', replyToId: 'r1' })
  })
})

describe('Owner comments', () => {
  it('show as Owner instead of a name', () => {
    expect(commentAuthorName(c('a', '', { byAuthor: 1, authorName: 'Ignored' }))).toBe('Owner')
    expect(commentAuthorName(c('a', '', { authorName: 'Sam' }))).toBe('Sam')
  })

  it('belong to the experience’s author, not to whoever createdBy names', () => {
    const owner = { ...c('a', '', { byAuthor: 1 }), createdBy: 'app-owner' }
    expect(isOwnComment(owner, 'author', true)).toBe(true)
    expect(isOwnComment(owner, 'app-owner', false)).toBe(false)
    const named = { ...c('b', ''), createdBy: 'sam' }
    expect(isOwnComment(named, 'sam', false)).toBe(true)
    expect(isOwnComment(named, null, false)).toBe(false)
  })
})
