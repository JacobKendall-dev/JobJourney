/**
 * Admin actions for companies: verify, and delete (only when no experiences
 * use the company). See docs/JobJourney Data Design.md § Actions.
 */

import type { ActionHandler, QueryActionData } from 'deepspace/worker'
import type { Env } from '../../worker'
import { readId, refuse, requireAdmin } from './guards'

/** params: { companyId: string, verified: boolean } */
export const setCompanyVerified: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const denied = await requireAdmin(env, userId)
  if (denied) return denied

  const companyId = readId(params, 'companyId')
  if (!companyId) return refuse('Missing or invalid companyId.', 'invalid_params')
  if (typeof params.verified !== 'boolean') return refuse('verified must be true or false.', 'invalid_params')
  const verified = params.verified

  const existing = await tools.get('companies', companyId)
  if (!existing.success) return refuse('That company no longer exists.', 'not_found')

  // Send the boolean itself: the verifiedAt timestampTrigger fires when
  // `verified` becomes exactly `true`. Unverifying clears who and when.
  const result = await tools.update('companies', companyId, {
    verified,
    verifiedBy: verified ? userId : null,
    ...(verified ? {} : { verifiedAt: null }),
  })
  if (!result.success) return refuse(result.error)

  console.info(`[action] setCompanyVerified company=${companyId} verified=${verified} by=${userId}`)
  return { success: true, data: { companyId, verified } }
}

/** deleteWhere removes at most this many rows per call. */
const BATCH = 100
/** Upper bound on batches, so a bug can never loop forever. */
const MAX_BATCHES = 50

/** params: { companyId: string } */
export const deleteCompany: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const denied = await requireAdmin(env, userId)
  if (denied) return denied

  const companyId = readId(params, 'companyId')
  if (!companyId) return refuse('Missing or invalid companyId.', 'invalid_params')

  const existing = await tools.get('companies', companyId)
  if (!existing.success) return refuse('That company no longer exists.', 'not_found')

  // Refuse while any experience uses this company. If the check itself fails,
  // refuse too: deleting without knowing would strand experiences.
  const used = (await tools.query('experiences', { where: { companyId }, limit: 1 })) as
    | { success: true; data: QueryActionData }
    | { success: false; error: string }
  if (!used.success) return refuse("Couldn't check this company's experiences. Try again.", 'check_failed')
  if (used.data.records.length > 0) {
    return refuse(
      'This company still has experiences. Delete those experiences first, then delete the company.',
      'has_experiences',
    )
  }

  // Its positions go with it (no experience uses them: none use the company).
  let positionsDeleted = 0
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const removed = await tools.deleteWhere('positions', { companyId }, BATCH)
    if (!removed.success) return refuse(`Couldn't remove the company's positions: ${removed.error}`)
    positionsDeleted += removed.data.deleted
    if (removed.data.deleted < BATCH) break
  }

  const result = await tools.remove('companies', companyId)
  if (!result.success) return refuse(result.error)

  console.info(`[action] deleteCompany company=${companyId} positions=${positionsDeleted} by=${userId}`)
  return { success: true, data: { companyId, positionsDeleted } }
}
