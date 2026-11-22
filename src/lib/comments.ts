/**
 * Comment helpers shared by the postComment action and the comment thread.
 * Pure, so they can be unit tested.
 */

import { COMMENT_MAX, type Comment } from '../schemas/comments-schema'
import { isTrue } from './options'

export { COMMENT_MAX }

export interface CommentRecord {
  recordId: string
  createdBy: string
  createdAt: string
  updatedAt: string
  data: Comment
}

export interface ThreadEntry {
  comment: CommentRecord
  replies: CommentRecord[]
}

/** A trimmed body of 1–1,000 characters, or an error message. */
export function checkCommentBody(value: unknown): { ok: true; body: string } | { ok: false; error: string } {
  const body = typeof value === 'string' ? value.trim() : ''
  if (!body) return { ok: false, error: 'Write something first.' }
  if (body.length > COMMENT_MAX) return { ok: false, error: `Keep comments under ${COMMENT_MAX.toLocaleString()} characters.` }
  return { ok: true, body }
}

const byOldest = (a: CommentRecord, b: CommentRecord) => a.createdAt.localeCompare(b.createdAt)

/**
 * Top-level comments oldest first, each with its replies oldest first.
 * A reply whose parent is missing is shown as top-level rather than lost.
 */
export function buildThread(comments: CommentRecord[]): ThreadEntry[] {
  const ids = new Set(comments.map((c) => c.recordId))
  const replies = new Map<string, CommentRecord[]>()
  const top: CommentRecord[] = []
  for (const c of comments) {
    const parent = c.data.parentId
    if (parent && ids.has(parent)) {
      const list = replies.get(parent) ?? []
      list.push(c)
      replies.set(parent, list)
    } else {
      top.push(c)
    }
  }
  return top.sort(byOldest).map((comment) => ({
    comment,
    replies: (replies.get(comment.recordId) ?? []).sort(byOldest),
  }))
}

/** Edited = updated more than a few seconds after it was posted. */
export function isEdited(c: Pick<CommentRecord, 'createdAt' | 'updatedAt'>): boolean {
  const created = Date.parse(c.createdAt)
  const updated = Date.parse(c.updatedAt)
  return Number.isFinite(created) && Number.isFinite(updated) && updated - created > 5000
}

export const isDeleted = (c: Pick<CommentRecord, 'data'>) => isTrue(c.data.deleted)
export const isByAuthor = (c: Pick<CommentRecord, 'data'>) => isTrue(c.data.byAuthor)

export const OWNER_LABEL = 'Owner'

/** The name shown on a comment: "Owner" for the experience's author. */
export function commentAuthorName(c: Pick<CommentRecord, 'data'>): string {
  if (isByAuthor(c)) return OWNER_LABEL
  return c.data.authorName?.trim() || 'Member'
}

/**
 * Whether the viewer wrote this comment. Owner comments are written under the
 * app's identity, so for those it's "you wrote this experience", not createdBy.
 */
export function isOwnComment(c: CommentRecord, userId: string | null, viewerIsAuthor: boolean): boolean {
  if (!userId) return false
  return isByAuthor(c) ? viewerIsAuthor : c.createdBy === userId
}

/**
 * Where a reply goes, given the comment being replied to. Replies stay one
 * level deep: a reply to a reply joins the same top-level comment and
 * remembers the reply it answers.
 */
export function replyPlacement(target: { recordId: string; data: Pick<Comment, 'parentId'> }): {
  parentId: string
  replyToId?: string
} {
  return target.data.parentId
    ? { parentId: target.data.parentId, replyToId: target.recordId }
    : { parentId: target.recordId }
}

/** "1 comment", "3 comments". */
export function commentCountText(n: number): string {
  return `${n} ${n === 1 ? 'comment' : 'comments'}`
}
