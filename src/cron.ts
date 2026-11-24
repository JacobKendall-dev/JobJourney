/**
 * Cron task definitions — registered into the AppCronRoom DO at construction
 * time (worker.ts). The DO alarm fires `runTask(name, env)` on the schedule
 * declared here; the DO itself records executions, tracks history, and
 * pushes status to admin clients via the `/ws/cron/:roomId` WebSocket.
 *
 * Each task declares EITHER `intervalMinutes` (run every N minutes) OR
 * `schedule` + `timezone` (5-field cron expression). A schedule arms on the
 * app's first request after a deploy.
 *
 * Tasks:
 * - `comment-digest`, daily at 09:00 UTC: emails authors who opted in about
 *   new comments on their posts (src/server/comment-digest.ts). Each email
 *   costs $0.013 from the owner's credits, capped in src/lib/paid-limits.ts.
 */

import type { CronTask } from 'deepspace/worker'
import { buildCronContext } from 'deepspace/worker'
import type { Env } from '../worker'
import { runCommentDigest } from './server/comment-digest'
import { createOwnerRecordTools } from './server/record-tools'

export const tasks: CronTask[] = [{ name: 'comment-digest', schedule: '0 9 * * *', timezone: 'UTC' }]

export async function runTask(name: string, env: Env): Promise<void> {
  if (name !== 'comment-digest') return
  const tools = createOwnerRecordTools(env)
  if (!tools) throw new Error('comment-digest: OWNER_USER_ID is missing')
  const { integrations } = buildCronContext(env, env.OWNER_USER_ID, `app:${env.DEEPSPACE_APP_ID}`)
  const result = await runCommentDigest({
    tools,
    appUrl: `https://${env.APP_NAME}.app.space`,
    send: async (to, email) => {
      await integrations.call('email/send', {
        from: `JobJourney <${env.APP_NAME}@app.space>`,
        to,
        subject: email.subject,
        text: email.text,
        html: email.html,
      })
    },
  })
  console.info(`[cron] comment-digest sent=${result.sent} skipped=${result.skipped} failed=${result.failed}`)
}
