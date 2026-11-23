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
import { validateExperienceContent, validateNewExperience, type NewExperience } from '../lib/experience-input'
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

export type OwnerTools = NonNullable<ReturnType<typeof createOwnerRecordTools>>
type Added = { companyId?: string; positionId?: string }
type PlaceResult =
  | { ok: true; companyId: string; positionId: string; added: Added }
  | { ok: false; refusal: ReturnType<typeof refuse> }

const isDuplicate = (error: string) => /^duplicate/i.test(error.trim())

/** The first row matching `where`, or null. Undefined if the query failed. */
async function findOne(tools: ActionTools, collection: string, where: Record<string, unknown>) {
  const found = await tools.query(collection, { where, limit: 1 })
  if (!found.success) return undefined
  return found.data.records[0]?.recordId ?? null
}

/**
 * Check or add the company and position for a new experience. A "new" one
 * that already exists (same slug; same title and level at the company) is
 * reused rather than refused, so two people adding it at once both succeed.
 */
async function resolvePlace(tools: ActionTools, owner: OwnerTools, input: NewExperience): Promise<PlaceResult> {
  const fail = (message: string, code: string): PlaceResult => ({ ok: false, refusal: refuse(message, code) })
  const added: Added = {}

  let companyId = input.companyId
  if (input.newCompany) {
    const fields = input.newCompany
    companyId = (await findOne(tools, 'companies', { slug: fields.slug })) ?? undefined
    if (!companyId) {
      const made = await owner.create('companies', { ...fields })
      if (made.success) companyId = added.companyId = made.data.recordId
      else if (isDuplicate(made.error)) companyId = (await findOne(tools, 'companies', { slug: fields.slug })) ?? undefined
      if (!companyId) return fail("Couldn't add the company. Try again.", 'company_failed')
    }
  } else {
    const company = companyId ? await tools.get('companies', companyId) : undefined
    if (!company?.success) return fail('That company no longer exists.', 'company_not_found')
  }
  if (!companyId) return fail('Choose the company.', 'invalid_params')

  let positionId = input.positionId
  if (input.newPosition) {
    const where = { companyId, title: input.newPosition.title, level: input.newPosition.level }
    positionId = (await findOne(tools, 'positions', where)) ?? undefined
    if (!positionId) {
      const made = await owner.create('positions', { companyId, ...input.newPosition })
      if (made.success) positionId = added.positionId = made.data.recordId
      else if (isDuplicate(made.error)) positionId = (await findOne(tools, 'positions', where)) ?? undefined
    }
    if (!positionId) {
      await undoAdded(owner, added)
      return fail("Couldn't add the position. Try again.", 'position_failed')
    }
  } else {
    const position = positionId ? await tools.get<{ companyId?: string }>('positions', positionId) : undefined
    if (!position?.success || position.data.record.data.companyId !== companyId) {
      await undoAdded(owner, added)
      return fail("That position isn't listed for this company.", 'position_not_found')
    }
  }

  return { ok: true, companyId, positionId: positionId!, added }
}

/** Remove a company or position this request added, when the share fails after all. */
async function undoAdded(owner: OwnerTools, added: Added) {
  if (added.positionId) await owner.remove('positions', added.positionId)
  if (added.companyId) await owner.remove('companies', added.companyId)
}

/**
 * params: the share form — companyId or newCompany, positionId or
 * newPosition, appliedMonth,
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

  // The name comes from the account, never from the browser.
  let authorName: string | undefined
  if (input.showName) {
    const user = await tools.get<{ name?: string }>('users', userId)
    authorName = user.success ? user.data.record.data.name?.trim().slice(0, AUTHOR_NAME_MAX) : undefined
    if (!authorName) {
      return refuse('Your account has no display name, so post anonymously or add a name first.', 'no_name')
    }
  }

  // The company and position: existing ones are checked, new ones are added
  // now (as the owner, so their createdBy doesn't point at the author).
  const place = await resolvePlace(tools, owner, input)
  if (!place.ok) return place.refusal
  const { companyId, positionId, added } = place

  const created = await owner.create('experiences', {
    companyId,
    positionId,
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
  if (!created.success) {
    await undoAdded(owner, added)
    return refuse(`Couldn't share your experience: ${created.error}`)
  }
  const experienceId = created.data.recordId

  // The private author row, written as the caller.
  const author = await tools.create('experienceAuthors', { experienceId })
  if (!author.success) {
    // Without an author row nobody could edit or delete the post; undo it.
    await owner.remove('experiences', experienceId)
    await undoAdded(owner, added)
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
 * Remove an experience (with the owner tools), then its votes, bookmarks,
 * comments and author row. Runs even if the experience is already gone, so a
 * half-finished earlier delete can be finished. The author row goes last, so
 * the author can retry. Every deleteWhere is scoped to this id.
 * Returns an error message, or null when everything is gone.
 */
export async function removeExperienceAndRows(
  tools: ActionTools,
  owner: OwnerTools,
  experienceId: string,
): Promise<string | null> {
  const existing = await tools.get('experiences', experienceId)
  if (existing.success) {
    const removed = await owner.remove('experiences', experienceId)
    if (!removed.success) return `Couldn't delete the experience: ${removed.error}`
  }
  for (const collection of CASCADE) {
    for (;;) {
      const result = await tools.deleteWhere(collection, { experienceId }, CASCADE_BATCH)
      if (!result.success) return "Deleted the experience, but couldn't finish cleaning up. Try again."
      if (result.data.deleted < CASCADE_BATCH) break
    }
  }
  return null
}

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

  const failed = await removeExperienceAndRows(tools, owner, experienceId)
  if (failed) return refuse(failed)

  // Say which kind of caller, never who: the author of an anonymous post is private.
  console.info(`[action] deleteExperience experience=${experienceId} by=${author ? 'author' : 'admin'}`)
  return { success: true, data: { experienceId } }
}
