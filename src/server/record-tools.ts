/**
 * Record tools that reach the app's record room with permissions OFF
 * (`X-App-Action: 'true'`), acting as a given user.
 *
 * The acting user matters: every record a tool creates gets `createdBy` set
 * to it, and `createdBy` is sent to everyone who can read the record.
 *
 * - `createRecordTools(env, callerId)` acts as the caller. Action routes
 *   build the normal `tools` with it.
 * - `createOwnerRecordTools(env)` acts as the app owner. Use it ONLY for
 *   writes that must not reveal who triggered them — experiences, so an
 *   anonymous post's `createdBy` is the owner, the same on every post.
 *
 * Both are server-only and bypass every permission rule; the action using
 * them must make its own checks.
 */

import type { ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker.js'

export type RecordTools = Omit<ActionTools, 'integration'>

export function createRecordTools(env: Env, actingUserId: string): RecordTools {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))

  // The DO returns ActionResult<unknown>; callers below supply the precise
  // operation result type fixed by the SDK tools-api wire contract.
  async function execTool<TData>(
    tool: string,
    params: Record<string, unknown>,
  ): Promise<ActionResult<TData>> {
    const res = await stub.fetch(
      new Request('https://internal/api/tools/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': actingUserId,
          'X-App-Action': 'true',
        },
        body: JSON.stringify({ tool, params }),
      }),
    )
    return res.json() as Promise<ActionResult<TData>>
  }

  return {
    create: (collection, data, recordId) =>
      execTool('records.create', { collection, data, recordId }),
    update: (collection, recordId, data) =>
      execTool('records.update', { collection, recordId, data }),
    remove: (collection, recordId) => execTool('records.delete', { collection, recordId }),
    deleteWhere: (collection, where, limit) =>
      execTool('records.deleteWhere', { collection, where, limit }),
    get: (collection, recordId) => execTool('records.get', { collection, recordId }),
    query: (collection, options) => execTool('records.query', { collection, ...options }),
    registerUser: (options) => execTool('users.register', { ...options }),
  }
}

/**
 * Tools that write as the app owner, or null when OWNER_USER_ID is missing.
 * Callers must refuse on null rather than fall back to the caller's tools,
 * which would stamp the caller's id on the record.
 */
export function createOwnerRecordTools(env: Env): RecordTools | null {
  return env.OWNER_USER_ID ? createRecordTools(env, env.OWNER_USER_ID) : null
}
