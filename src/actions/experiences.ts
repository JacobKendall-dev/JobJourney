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

import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { validateNewExperience } from '../lib/experience-input'
import { createOwnerRecordTools } from '../server/record-tools'
import { refuse } from './guards'

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
