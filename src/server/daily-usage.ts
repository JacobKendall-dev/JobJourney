/**
 * Daily caps for paid calls, kept in the dailyUsage collection.
 *
 * `takeDailySlot` counts one use and says whether it was within the cap. Two
 * requests at the same moment can both pass at the cap's edge; that's an
 * acceptable overshoot of one for a spending limit.
 */

import type { DailyUsage } from '../schemas/daily-usage-schema'
import type { RecordTools } from './record-tools'

type Tools = Pick<RecordTools, 'query' | 'create' | 'update'>

/** Today's date (UTC) as YYYY-MM-DD. */
export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10)

/** A short one-way hash of a user id, so usage keys don't hold the id itself. */
export async function hashId(id: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)))
  return Array.from(bytes.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function findUsage(tools: Tools, key: string) {
  const found = await tools.query<DailyUsage>('dailyUsage', { where: { key }, limit: 1 })
  if (!found.success) return { ok: false as const }
  return { ok: true as const, record: found.data.records[0] }
}

/**
 * Counts one use of `key` if it's under `max`. Returns false at the cap or if
 * the count can't be read, so a storage problem never means unlimited spend.
 */
export async function takeDailySlot(tools: Tools, key: string, max: number): Promise<boolean> {
  const usage = await findUsage(tools, key)
  if (!usage.ok) return false
  const used = Number(usage.record?.data.count ?? 0)
  if (used >= max) return false
  const saved = usage.record
    ? await tools.update('dailyUsage', usage.record.recordId, { count: used + 1 })
    : await tools.create('dailyUsage', { key, count: 1 })
  return saved.success
}

/** A stored text value, such as when the digest last ran. */
export async function readUsageValue(tools: Tools, key: string): Promise<string | null> {
  const usage = await findUsage(tools, key)
  return usage.ok ? (usage.record?.data.value ?? null) : null
}

export async function writeUsageValue(tools: Tools, key: string, value: string): Promise<boolean> {
  const usage = await findUsage(tools, key)
  if (!usage.ok) return false
  const saved = usage.record
    ? await tools.update('dailyUsage', usage.record.recordId, { value })
    : await tools.create('dailyUsage', { key, value })
  return saved.success
}
