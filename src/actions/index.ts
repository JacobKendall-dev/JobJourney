/**
 * Server actions, exposed at POST /api/actions/<name>.
 *
 * Record permissions are OFF inside actions (see src/server/action-routes.ts),
 * so each action checks the caller's role and the records it touches itself.
 */

import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { deleteCompany, setCompanyVerified } from './companies'
import { seedSampleData } from './sample-data'

export const actions: Record<string, ActionHandler<Env>> = {
  setCompanyVerified,
  deleteCompany,
  seedSampleData,
}
