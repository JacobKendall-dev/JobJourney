/**
 * The daily comment digest: one email per author who opted in
 * (users.notifyComments), listing their posts with new comments since the
 * last run. Run by the `comment-digest` task in src/cron.ts.
 *
 * - At most DIGEST_EMAILS_PER_RUN emails a run ($0.013 each).
 * - If a send fails (credits used up, or anything else), the rest of the run
 *   is skipped. The run still moves `digest:last` forward, so those comments
 *   aren't emailed later: the digest is a nudge, not a record.
 * - Logs counts only: never an address, a user id or a post id.
 */

import { DIGEST_EMAILS_PER_RUN, DIGEST_ENABLED } from '../lib/paid-limits'
import { countNewComments, digestEmail, type DigestComment, type DigestEmail, type DigestPost } from '../lib/digest'
import { isTrue } from '../lib/options'
import { readUsageValue, writeUsageValue } from './daily-usage'
import type { RecordTools } from './record-tools'

/** Comments read per run, newest first. Far more than a day's worth here. */
const COMMENTS_PER_RUN = 500
const LAST_RUN_KEY = 'digest:last'
const DAY_MS = 24 * 60 * 60 * 1000

export interface DigestDeps {
  tools: Pick<RecordTools, 'query' | 'get' | 'create' | 'update'>
  /** Sends one email; throws if it couldn't. */
  send: (to: string, email: DigestEmail) => Promise<void>
  appUrl: string
  now?: Date
}

export interface DigestResult {
  sent: number
  skipped: number
  failed: boolean
}

export async function runCommentDigest({ tools, send, appUrl, now = new Date() }: DigestDeps): Promise<DigestResult> {
  const result: DigestResult = { sent: 0, skipped: 0, failed: false }
  if (!DIGEST_ENABLED) return result

  const until = now.toISOString()
  const since = (await readUsageValue(tools, LAST_RUN_KEY)) ?? new Date(now.getTime() - DAY_MS).toISOString()

  const comments = await tools.query<DigestComment['data']>('comments', { limit: COMMENTS_PER_RUN })
  if (!comments.success) throw new Error('comment-digest: could not read comments')
  const counts = countNewComments(comments.data.records, since, until)

  // Posts by author. experienceAuthors.createdBy is the author.
  const byAuthor = new Map<string, Array<{ experienceId: string; count: number }>>()
  for (const [experienceId, count] of counts) {
    const found = await tools.query('experienceAuthors', { where: { experienceId }, limit: 1 })
    const authorId = found.success ? found.data.records[0]?.createdBy : undefined
    if (!authorId) continue
    byAuthor.set(authorId, [...(byAuthor.get(authorId) ?? []), { experienceId, count }])
  }

  for (const [authorId, posts] of byAuthor) {
    const user = await tools.get<{ email?: string; notifyComments?: unknown }>('users', authorId)
    const email = user.success ? user.data.record.data.email : undefined
    if (!user.success || !isTrue(user.data.record.data.notifyComments) || !email) continue
    if (result.sent >= DIGEST_EMAILS_PER_RUN || result.failed) {
      result.skipped++
      continue
    }
    const titled = await Promise.all(posts.map((p) => titlePost(tools, p)))
    try {
      await send(email, digestEmail(titled, appUrl))
      result.sent++
    } catch {
      result.failed = true
      result.skipped++
    }
  }

  await writeUsageValue(tools, LAST_RUN_KEY, until)
  return result
}

/** "Software Engineer at Acme" for the email; a plain fallback if anything's missing. */
async function titlePost(tools: DigestDeps['tools'], post: { experienceId: string; count: number }): Promise<DigestPost> {
  const fallback = { ...post, title: 'Your experience' }
  const experience = await tools.get<{ companyId?: string; positionId?: string }>('experiences', post.experienceId)
  if (!experience.success) return fallback
  const { companyId, positionId } = experience.data.record.data
  const [company, position] = await Promise.all([
    companyId ? tools.get<{ name?: string }>('companies', companyId) : null,
    positionId ? tools.get<{ title?: string }>('positions', positionId) : null,
  ])
  const name = company?.success ? company.data.record.data.name : undefined
  const title = position?.success ? position.data.record.data.title : undefined
  if (!name) return fallback
  return { ...post, title: title ? `${title} at ${name}` : `Your experience at ${name}` }
}
