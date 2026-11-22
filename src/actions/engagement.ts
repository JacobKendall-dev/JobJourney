/**
 * Helpful votes and comments. See docs/JobJourney Data Design.md § Actions.
 *
 * Votes and ordinary comments are written as the CALLER (so `createdBy` /
 * `userId` is the voter or commenter). Then the experience's counter is
 * RECOUNTED instead of adding 1: there is no atomic increment, and a recount
 * corrects itself when two writes land at once. Counters are written with
 * the OWNER tools, like every experience write.
 *
 * Comments by the experience's AUTHOR are different: they show as "Owner"
 * and are written with the OWNER tools, so their `createdBy` can't be
 * matched to the author's other, named comments. That keeps anonymous posts
 * anonymous when their author joins the discussion.
 *
 * Action queries have no default limit, so a recount sees every row.
 */

import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { checkCommentBody, replyPlacement } from '../lib/comments'
import { isTrue } from '../lib/options'
import { createOwnerRecordTools, type RecordTools } from '../server/record-tools'
import { readId, refuse, requireMember } from './guards'

const AUTHOR_NAME_MAX = 100

type StoredComment = { experienceId?: string; parentId?: string; byAuthor?: unknown; deleted?: unknown }

/** Count matching rows and store the count on the experience. Null if either step failed. */
async function recount(
  tools: ActionTools,
  owner: RecordTools,
  collection: 'helpfulVotes' | 'comments',
  field: 'helpfulCount' | 'commentCount',
  experienceId: string,
): Promise<number | null> {
  const rows = await tools.query(collection, { where: { experienceId } })
  if (!rows.success) return null
  const count = rows.data.records.length
  const saved = await owner.update('experiences', experienceId, { [field]: count })
  return saved.success ? count : null
}

/**
 * Whether `userId` wrote this experience. Permissions are off in actions, so
 * this reads the private author row; only the yes/no leaves the server.
 * Null when the lookup failed.
 */
async function isExperienceAuthor(tools: ActionTools, experienceId: string, userId: string) {
  const rows = await tools.query('experienceAuthors', { where: { experienceId, createdBy: userId }, limit: 1 })
  return rows.success ? rows.data.records.length > 0 : null
}

/**
 * params: { experienceId }. Adds the caller's vote, or removes it if they
 * already voted. Returns { voted, helpfulCount }.
 */
export const toggleHelpful: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const denied = requireMember(userId)
  if (denied) return denied
  const owner = createOwnerRecordTools(env)
  if (!owner) return refuse("Voting isn't available right now. Try again later.", 'owner_unavailable')
  const experienceId = readId(params, 'experienceId')
  if (!experienceId) return refuse('Missing experience.', 'invalid_params')

  const experience = await tools.get('experiences', experienceId)
  if (!experience.success) return refuse('That experience no longer exists.', 'not_found')

  // Authors can't vote on their own post.
  const author = await isExperienceAuthor(tools, experienceId, userId)
  if (author === null) return refuse("Couldn't update your vote. Try again.")
  if (author) return refuse("You can't mark your own post helpful.", 'own_post')

  const existing = await tools.query('helpfulVotes', { where: { experienceId, userId } })
  if (!existing.success) return refuse("Couldn't update your vote. Try again.")

  let voted: boolean
  if (existing.data.records.length > 0) {
    for (const vote of existing.data.records) await tools.remove('helpfulVotes', vote.recordId)
    voted = false
  } else {
    const created = await tools.create('helpfulVotes', { experienceId, userId })
    // "Duplicate" means a vote landed meanwhile (a double click): still voted.
    if (!created.success && !/duplicate/i.test(created.error)) {
      return refuse("Couldn't save your vote. Try again.")
    }
    voted = true
  }

  const helpfulCount = await recount(tools, owner, 'helpfulVotes', 'helpfulCount', experienceId)
  return { success: true, data: { voted, helpfulCount } }
}

/**
 * params: { experienceId, body, parentId? }. `parentId` is the comment being
 * replied to, top-level or a reply. Replies stay one level deep: a reply to a
 * reply joins the same top-level comment (see replyPlacement).
 * Returns { commentId, commentCount }.
 */
export const postComment: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const denied = requireMember(userId)
  if (denied) return denied
  const owner = createOwnerRecordTools(env)
  if (!owner) return refuse("Commenting isn't available right now. Try again later.", 'owner_unavailable')
  const experienceId = readId(params, 'experienceId')
  if (!experienceId) return refuse('Missing experience.', 'invalid_params')
  const checked = checkCommentBody(params.body)
  if (!checked.ok) return refuse(checked.error, 'invalid_params')

  const hasTarget = params.parentId !== undefined && params.parentId !== null && params.parentId !== ''
  const targetId = hasTarget ? readId(params, 'parentId') : null
  if (hasTarget && !targetId) return refuse("That comment doesn't exist.", 'parent_not_found')

  const experience = await tools.get('experiences', experienceId)
  if (!experience.success) return refuse('That experience no longer exists.', 'not_found')

  let placement: { parentId?: string; replyToId?: string } = {}
  if (targetId) {
    const target = await tools.get<StoredComment>('comments', targetId)
    if (!target.success || target.data.record.data.experienceId !== experienceId) {
      return refuse("That comment doesn't exist.", 'parent_not_found')
    }
    if (isTrue(target.data.record.data.deleted)) return refuse('That comment was deleted.', 'parent_deleted')
    placement = replyPlacement(target.data.record)
  }

  const byAuthor = await isExperienceAuthor(tools, experienceId, userId)
  if (byAuthor === null) return refuse("Couldn't post your comment. Try again.")

  const comment = { experienceId, ...placement, body: checked.body, deleted: false }
  let created
  if (byAuthor) {
    // "Owner": written as the app, with no name, so nothing points at the author.
    created = await owner.create('comments', { ...comment, byAuthor: true })
  } else {
    // The name comes from the account, never from the browser.
    const user = await tools.get<{ name?: string }>('users', userId)
    const authorName = user.success ? user.data.record.data.name?.trim().slice(0, AUTHOR_NAME_MAX) : undefined
    if (!authorName) return refuse('Your account has no display name. Add one in Settings, then comment.', 'no_name')
    created = await tools.create('comments', { ...comment, authorName })
  }
  if (!created.success) return refuse(`Couldn't post your comment: ${created.error}`)

  const commentCount = await recount(tools, owner, 'comments', 'commentCount', experienceId)
  return { success: true, data: { commentId: created.data.recordId, commentCount } }
}

/**
 * params: { commentId, body } to edit, or { commentId, delete: true } to
 * soft-delete. Only for "Owner" comments: they're stored under the app's
 * identity, so the author can't change them directly. Other comments are
 * edited directly (the schema allows `body` and `deleted` on your own).
 */
export const updateAuthorComment: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const denied = requireMember(userId)
  if (denied) return denied
  const owner = createOwnerRecordTools(env)
  if (!owner) return refuse("Editing isn't available right now. Try again later.", 'owner_unavailable')
  const commentId = readId(params, 'commentId')
  if (!commentId) return refuse('Missing comment.', 'invalid_params')

  const comment = await tools.get<StoredComment>('comments', commentId)
  if (!comment.success) return refuse("That comment doesn't exist.", 'not_found')
  const data = comment.data.record.data
  const forbidden = refuse('You can only change your own comments.', 'forbidden')
  if (!isTrue(data.byAuthor) || !data.experienceId) return forbidden
  if ((await isExperienceAuthor(tools, data.experienceId, userId)) !== true) return forbidden
  if (isTrue(data.deleted)) return refuse('That comment was already deleted.', 'already_deleted')

  if (params.delete === true) {
    const saved = await owner.update('comments', commentId, { deleted: true, body: '' })
    return saved.success ? { success: true, data: { commentId } } : refuse("Couldn't delete the comment. Try again.")
  }
  const checked = checkCommentBody(params.body)
  if (!checked.ok) return refuse(checked.error, 'invalid_params')
  const saved = await owner.update('comments', commentId, { body: checked.body })
  return saved.success ? { success: true, data: { commentId } } : refuse("Couldn't save the comment. Try again.")
}
