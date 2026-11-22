/**
 * Call a server action (`POST /api/actions/:name`) as the signed-in user.
 *
 * The SDK serves the route but has no browser helper. Actions run with record
 * permissions OFF, so every check lives in the action itself; this helper only
 * carries the caller's token. It never throws: network failures, refusals and
 * non-JSON replies all come back as `{ success: false, error }` with a message
 * that can be shown to the user.
 */

import { getAuthToken } from 'deepspace'

export type ActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number }

export async function callAction<T = unknown>(
  name: string,
  params: Record<string, unknown> = {},
): Promise<ActionResponse<T>> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Sign in to do this.', status: 401 }

  let res: Response
  try {
    res = await fetch(`/api/actions/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    })
  } catch {
    return {
      success: false,
      error: "Couldn't reach the server. Check your connection and try again.",
    }
  }

  let body: { success?: boolean; data?: T; error?: string } | null = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok || !body || body.success === false) {
    const fallback =
      res.status === 401 ? 'Sign in to do this.' : `Something went wrong (${res.status}). Try again.`
    return { success: false, error: body?.error || fallback, status: res.status }
  }
  return { success: true, data: body.data as T }
}
