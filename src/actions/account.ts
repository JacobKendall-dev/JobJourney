/**
 * deleteAccount — removes everything this person has in JobJourney.
 *
 * A DeepSpace sign-in is one account across every DeepSpace app, so an app
 * can't delete the sign-in itself. This deletes the person's JobJourney data
 * and their users row; the browser then signs them out. Signing in again
 * starts a fresh, empty profile.
 *
 * - Their experiences, each with its votes, bookmarks, comments and author row.
 * - Their helpful votes (and the counts on those experiences are recounted).
 * - Their bookmarks.
 * - Their comments become "[deleted]" with no name, so replies to them still
 *   make sense (the same as deleting a comment yourself).
 * - Their users row (name, email, role).
 *
 * Companies they added on the Companies page stay: they're shared listings.
 * Every step can be run again, so a failed delete can be retried.
 */

import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { isTrue } from '../lib/options'
import { createOwnerRecordTools } from '../server/record-tools'
import { recount } from './engagement'
import { removeExperienceAndRows } from './experiences'
import { refuse, requireMember } from './guards'

const BATCH = 500

/** params: { confirm: true }. Returns counts of what was removed. */
export const deleteAccount: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const denied = requireMember(userId)
  if (denied) return denied
  if (params.confirm !== true) return refuse('Confirm that you want to delete your account.', 'invalid_params')
  if (userId === env.OWNER_USER_ID) {
    return refuse("The app owner's account can't be deleted here.", 'owner_account')
  }
  const owner = createOwnerRecordTools(env)
  if (!owner) return refuse("Deleting isn't available right now. Try again later.", 'owner_unavailable')
  const failed = (step: string) => refuse(`Couldn't finish deleting your ${step}. Nothing else changed; try again.`)

  // 1. Experiences they wrote, found through their private author rows.
  const authored = await tools.query('experienceAuthors', { where: { createdBy: userId } })
  if (!authored.success) return failed('posts')
  const experienceIds = [...new Set(authored.data.records.map((r) => String(r.data.experienceId ?? '')))].filter(Boolean)
  for (const experienceId of experienceIds) {
    if (await removeExperienceAndRows(tools, owner, experienceId)) return failed('posts')
  }

  // 2. Helpful votes, then fix the counts on the experiences they voted on.
  const votes = await tools.query('helpfulVotes', { where: { userId } })
  if (!votes.success) return failed('helpful votes')
  const voted = [...new Set(votes.data.records.map((r) => String(r.data.experienceId ?? '')))].filter(Boolean)
  for (;;) {
    const removed = await tools.deleteWhere('helpfulVotes', { userId }, BATCH)
    if (!removed.success) return failed('helpful votes')
    if (removed.data.deleted < BATCH) break
  }
  for (const experienceId of voted) {
    const exists = await tools.get('experiences', experienceId)
    if (exists.success) await recount(tools, owner, 'helpfulVotes', 'helpfulCount', experienceId)
  }

  // 3. Bookmarks.
  for (;;) {
    const removed = await tools.deleteWhere('bookmarks', { userId }, BATCH)
    if (!removed.success) return failed('bookmarks')
    if (removed.data.deleted < BATCH) break
  }

  // 4. Comments: blank them and drop the name, keeping threads intact.
  const comments = await tools.query('comments', { where: { createdBy: userId } })
  if (!comments.success) return failed('comments')
  let commentsCleared = 0
  for (const c of comments.data.records) {
    if (isTrue(c.data.deleted) && !c.data.authorName && !c.data.body) continue
    const cleared = await tools.update('comments', c.recordId, { deleted: true, body: '', authorName: null })
    if (!cleared.success) return failed('comments')
    commentsCleared++
  }

  // 5. Their profile in this app.
  const profile = await tools.get('users', userId)
  if (profile.success) {
    const removed = await tools.remove('users', userId)
    if (!removed.success) return failed('profile')
  }

  // Counts only: which posts were theirs stays private.
  console.info(
    `[action] deleteAccount posts=${experienceIds.length} votes=${voted.length} comments=${commentsCleared}`,
  )
  return {
    success: true,
    data: { experiencesDeleted: experienceIds.length, commentsCleared },
  }
}
