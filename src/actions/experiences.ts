/**
 * Experience actions. See docs/JobJourney Data Design.md § Actions.
 *
 * Anonymity depends on two identities:
 * - The public `experiences` record is written with OWNER tools, so its
 *   `createdBy` is the app owner on every post and reveals nothing.
 * - The private `experienceAuthors` row is written with the CALLER's tools,
 *   so its `createdBy` is the author and only they can read it.
 * Never write an experience with the caller's tools, and never copy the
 * caller's id onto an experience.
 */

import { resolveAppRole, type ActionHandler, type ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { validateExperienceContent, validateNewExperience } from '../lib/experience-input'
import { createOwnerRecordTools } from '../server/record-tools'
import { readId, refuse, requireMember } from './guards'

/**
 * Whether `userId` wrote this experience. Permissions are off in actions, so
 * this reads the private author row; only the yes/no is used. Null on failure.
 */
export async function isExperienceAuthor(tools: ActionTools, experienceId: string, userId: string) {
  const rows = await tools.query('experienceAuthors', { where: { experienceId, createdBy: userId }, limit: 1 })
  return rows.success ? rows.data.records.length > 0 : null
}

const AUTHOR_NAME_MAX = 100

/**
 * params: the share form — companyId, positionId, appliedMonth,
 * workArrangement?, firstResponseDays?, noResponse, interviewStages,
 * interviewFormats, outcome, interviewExperience?, advice?, showName.
 * Returns { experienceId }.
 */
export const createExperience: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const owner = createOwnerRecordTools(env)
  if (!owner) return refuse("Sharing isn't available right now. Try again later.", 'owner_unavailable')

  const checked = validateNewExperience(params)
  if (!checked.ok) {
    const first = Object.values(checked.errors)[0] ?? 'Check the form and try again.'
    return refuse(first, 'invalid_params')
  }
  const input = checked.value

  // The company and position must exist, and the position must belong to it.
  const company = await tools.get('companies', input.companyId)
  if (!company.success) return refuse('That company no longer exists.', 'company_not_found')
  const position = await tools.get<{ companyId?: string }>('positions', input.positionId)
  if (!position.success || position.data.record.data.companyId !== input.companyId) {
    return refuse("That position isn't listed for this company.", 'position_not_found')
  }

  // The name comes from the account, never from the browser.
  let authorName: string | undefined
  if (input.showName) {
    const user = await tools.get<{ name?: string }>('users', userId)
    authorName = user.success ? user.data.record.data.name?.trim().slice(0, AUTHOR_NAME_MAX) : undefined
    if (!authorName) {
      return refuse('Your account has no display name, so post anonymously or add a name first.', 'no_name')
    }
  }

  const created = await owner.create('experiences', {
    companyId: input.companyId,
    positionId: input.positionId,
    isAnonymous: !input.showName,
    ...(authorName ? { authorName } : {}),
    appliedMonth: input.appliedMonth,
    ...(input.workArrangement ? { workArrangement: input.workArrangement } : {}),
    ...(input.firstResponseDays !== undefined ? { firstResponseDays: input.firstResponseDays } : {}),
    noResponse: input.noResponse,
    interviewStages: input.interviewStages,
    interviewFormats: input.interviewFormats,
    outcome: input.outcome,
    ...(input.interviewExperience ? { interviewExperience: input.interviewExperience } : {}),
    ...(input.advice ? { advice: input.advice } : {}),
    helpfulCount: 0,
    commentCount: 0,
  })
  if (!created.success) return refuse(`Couldn't share your experience: ${created.error}`)
  const experienceId = created.data.recordId

  // The private author row, written as the caller.
  const author = await tools.create('experienceAuthors', { experienceId })
  if (!author.success) {
    // Without an author row nobody could edit or delete the post; undo it.
    await owner.remove('experiences', experienceId)
    return refuse("Couldn't share your experience. Nothing was saved; try again.", 'author_row_failed')
  }

  // Log the post, never the author: this line is visible in the app's logs.
  console.info(`[action] createExperience experience=${experienceId}`)
  return { success: true, data: { experienceId } }
}

/**
 * params: { experienceId, ...the share form's content fields, showName }.
 * Company and position can't change (they're immutable; any sent are
 * ignored). Written with the OWNER tools like every experience write.
 * Fields left empty are cleared (writing null clears a field).
 */
export const updateExperience: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const denied = requireMember(userId)
  if (denied) return denied
  const owner = createOwnerRecordTools(env)
  if (!owner) return refuse("Editing isn't available right now. Try again later.", 'owner_unavailable')
  const experienceId = readId(params, 'experienceId')
  if (!experienceId) return refuse('Missing experience.', 'invalid_params')

  const existing = await tools.get('experiences', experienceId)
  if (!existing.success) return refuse('That experience no longer exists.', 'not_found')
  const author = await isExperienceAuthor(tools, experienceId, userId)
  if (author === null) return refuse("Couldn't save your changes. Try again.")
  if (!author) return refuse('Only the person who shared this experience can edit it.', 'forbidden')

  const checked = validateExperienceContent(params)
  if (!checked.ok) {
    const first = Object.values(checked.errors)[0] ?? 'Check the form and try again.'
    return refuse(first, 'invalid_params')
  }
  const input = checked.value

  // The name comes from the account, never from the browser.
  let authorName: string | null = null
  if (input.showName) {
    const user = await tools.get<{ name?: string }>('users', userId)
    authorName = (user.success ? user.data.record.data.name?.trim().slice(0, AUTHOR_NAME_MAX) : undefined) || null
    if (!authorName) {
      return refuse('Your account has no display name, so post anonymously or add a name first.', 'no_name')
    }
  }

  // Only content fields: never companyId, positionId or the counters.
  const saved = await owner.update('experiences', experienceId, {
    isAnonymous: !input.showName,
    authorName,
    appliedMonth: input.appliedMonth,
    workArrangement: input.workArrangement ?? null,
    firstResponseDays: input.firstResponseDays ?? null,
    noResponse: input.noResponse,
    interviewStages: input.interviewStages,
    interviewFormats: input.interviewFormats,
    outcome: input.outcome,
    interviewExperience: input.interviewExperience ?? null,
    advice: input.advice ?? null,
  })
  if (!saved.success) return refuse(`Couldn't save your changes: ${saved.error}`)

  console.info(`[action] updateExperience experience=${experienceId}`)
  return { success: true, data: { experienceId } }
}

/** Collections that hang off an experience, deleted with it. */
const CASCADE = ['helpfulVotes', 'bookmarks', 'comments', 'experienceAuthors'] as const
const CASCADE_BATCH = 500

/**
 * params: { experienceId }. Deletes the experience, then its votes,
 * bookmarks, comments and private author row. Allowed for its author, or an
 * admin (moderation). Admins never learn who wrote it.
 */
export const deleteExperience: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const denied = requireMember(userId)
  if (denied) return denied
  const owner = createOwnerRecordTools(env)
  if (!owner) return refuse("Deleting isn't available right now. Try again later.", 'owner_unavailable')
  const experienceId = readId(params, 'experienceId')
  if (!experienceId) return refuse('Missing experience.', 'invalid_params')

  const author = await isExperienceAuthor(tools, experienceId, userId)
  if (author === null) return refuse("Couldn't delete the experience. Try again.")
  const allowed = author || (await resolveAppRole(env, userId)) === 'admin'
  if (!allowed) return refuse('Only the person who shared this experience, or an admin, can delete it.', 'forbidden')

  const existing = await tools.get('experiences', experienceId)
  if (existing.success) {
    const removed = await owner.remove('experiences', experienceId)
    if (!removed.success) return refuse(`Couldn't delete the experience: ${removed.error}`)
  }
  // Clean up even if the experience was already gone, so a half-finished
  // earlier delete can be finished. Every deleteWhere is scoped to this id.
  for (const collection of CASCADE) {
    for (;;) {
      const result = await tools.deleteWhere(collection, { experienceId }, CASCADE_BATCH)
      if (!result.success) return refuse(`Deleted the experience, but couldn't finish cleaning up. Try again.`)
      if (result.data.deleted < CASCADE_BATCH) break
    }
  }

  // Say which kind of caller, never who: the author of an anonymous post is private.
  console.info(`[action] deleteExperience experience=${experienceId} by=${author ? 'author' : 'admin'}`)
  return { success: true, data: { experienceId } }
}
