/**
 * dailyUsage — counts paid calls so the daily caps in src/lib/paid-limits.ts
 * hold, and remembers when the comment digest last ran.
 *
 * Keys look like `privacy:2026-11-23` (whole app), `privacy:2026-11-23:<hash>`
 * (one person, with their id hashed) and `digest:last`. Only actions and the
 * cron task touch it (permissions are off there). No role can read it, not
 * even admin, because a per-person count shows when someone checked a post.
 */

import type { CollectionSchema } from 'deepspace/schema'

export type DailyUsage = {
  key: string
  count?: number
  /** ISO time, for `digest:last`. */
  value?: string
}

const none = { read: false, create: false, update: false, delete: false } as const

export const dailyUsageSchema: CollectionSchema = {
  name: 'dailyUsage',
  columns: [
    { name: 'key', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'count', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'value', storage: 'text', interpretation: 'plain' },
  ],
  uniqueOn: ['key'],
  permissions: { viewer: none, member: none, admin: none },
}
