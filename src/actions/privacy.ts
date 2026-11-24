/**
 * reviewPrivacy — checks a post's story fields for details that could
 * identify someone, before it's shared or saved.
 *
 * Free pattern matching always runs. The Claude check runs only while the
 * daily caps in src/lib/paid-limits.ts allow it. If Claude can't be reached
 * (credits used up, or anything else) the pattern results come back alone, so
 * sharing never stops because of billing. Nothing about the post is logged.
 *
 * It only advises: createExperience doesn't require it.
 */

import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { STORY_MAX } from '../lib/experience-input'
import {
  PRIVACY_CHECKS_PER_DAY,
  PRIVACY_CHECKS_PER_USER_DAY,
  PRIVACY_CHECK_ENABLED,
  PRIVACY_MAX_TOKENS,
  PRIVACY_MODEL,
} from '../lib/paid-limits'
import { PRIVACY_PROMPT, findObviousDetails, mergeFlags, parseFlags, postText, type PrivacyFlag, type PrivacyReview } from '../lib/privacy'
import { hashId, takeDailySlot, utcDay } from '../server/daily-usage'
import { createOwnerRecordTools } from '../server/record-tools'
import { requireMember } from './guards'

export const reviewPrivacy: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const denied = requireMember(userId)
  if (denied) return denied

  const text = postText(params).slice(0, 2 * STORY_MAX + 2)
  const local = findObviousDetails(text)
  const done = (flags: PrivacyFlag[], checked: boolean) => ({
    success: true as const,
    data: { flags, checked } satisfies PrivacyReview,
  })
  if (!PRIVACY_CHECK_ENABLED || !text.trim()) return done(local, false)

  // Counted with the owner's tools so the counters' createdBy is the same on
  // every row. The per-person key holds a hash, not the id.
  const owner = createOwnerRecordTools(env)
  if (!owner) return done(local, false)
  const day = utcDay()
  const allowed =
    (await takeDailySlot(owner, `privacy:${day}`, PRIVACY_CHECKS_PER_DAY)) &&
    (await takeDailySlot(owner, `privacy:${day}:${await hashId(userId)}`, PRIVACY_CHECKS_PER_USER_DAY))
  if (!allowed) {
    console.info('[privacy] daily cap reached; patterns only')
    return done(local, false)
  }

  const reply = await tools.integration('anthropic/chat-completion', {
    model: PRIVACY_MODEL,
    max_tokens: PRIVACY_MAX_TOKENS,
    temperature: 0,
    system: PRIVACY_PROMPT,
    messages: [{ role: 'user', content: `<post>\n${text}\n</post>` }],
  })
  if (!reply.success) {
    console.warn(`[privacy] check unavailable: ${reply.code ?? 'error'}`)
    return done(local, false)
  }
  return done(mergeFlags(local, parseFlags(reply.data, text)), true)
}
