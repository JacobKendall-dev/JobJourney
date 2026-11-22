/**
 * Checks shared by actions. Actions run with record permissions OFF, so every
 * action that needs a role or a valid id checks it here, on the server.
 */

import { isAnonymousUserId, resolveAppRole, type ActionResult } from 'deepspace/worker'
import type { Env } from '../../worker'

export type Refusal = Extract<ActionResult, { success: false }>

export const refuse = (error: string, code?: string): Refusal => ({
  success: false,
  error,
  ...(code ? { code } : {}),
})

/** The caller's role from the app's users collection — never from the browser. */
export async function requireAdmin(env: Env, userId: string): Promise<Refusal | null> {
  const role = await resolveAppRole(env, userId)
  return role === 'admin' ? null : refuse('Only admins can do this.', 'forbidden')
}

/** Signed in with a real account, not a signed-out visitor's guest id. */
export function requireMember(userId: string): Refusal | null {
  return !userId || isAnonymousUserId(userId) ? refuse('Sign in to do this.', 'sign_in_required') : null
}

/** Record ids and slugs: letters, digits, dashes and underscores. */
const ID_RE = /^[A-Za-z0-9_-]{1,100}$/

export function readId(params: Record<string, unknown>, key: string): string | null {
  const value = params[key]
  return typeof value === 'string' && ID_RE.test(value) ? value : null
}
