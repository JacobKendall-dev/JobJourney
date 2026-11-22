/**
 * Numbers computed in the browser from loaded experiences: counts per company
 * and position, and a company's "at a glance" summary.
 */

import type { RecordData } from 'deepspace'
import type { Experience } from './experience'
import { OUTCOMES, isOneOf, isTrue, type Outcome } from './options'

export type ExperienceRecord = RecordData<Experience>

/** How many experiences each id has, e.g. countBy(experiences, 'companyId'). */
export function countBy(
  experiences: ExperienceRecord[],
  key: 'companyId' | 'positionId',
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const e of experiences) {
    const id = e.data[key]
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/** Middle value (average of the two middles for an even count), or undefined if empty. */
export function median(values: number[]): number | undefined {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (sorted.length === 0) return undefined
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export interface CompanyStats {
  count: number
  outcomes: Record<Outcome, number>
  /** Median days to first response, ignoring "no response yet" and unanswered. */
  medianFirstResponseDays?: number
  medianStages?: number
}

export function companyStats(experiences: ExperienceRecord[]): CompanyStats {
  const outcomes = Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>
  const responseDays: number[] = []
  const stages: number[] = []

  for (const { data } of experiences) {
    if (isOneOf(OUTCOMES, data.outcome)) outcomes[data.outcome] += 1
    if (!isTrue(data.noResponse) && typeof data.firstResponseDays === 'number' && data.firstResponseDays >= 0) {
      responseDays.push(data.firstResponseDays)
    }
    if (typeof data.interviewStages === 'number' && data.interviewStages >= 0) stages.push(data.interviewStages)
  }

  return {
    count: experiences.length,
    outcomes,
    medianFirstResponseDays: median(responseDays),
    medianStages: median(stages),
  }
}

export type ExperienceSort = 'newest' | 'helpful'

/** Newest first, or most helpful first (newest breaks ties). Returns a new array. */
export function sortExperiences(experiences: ExperienceRecord[], sort: ExperienceSort): ExperienceRecord[] {
  const newest = (a: ExperienceRecord, b: ExperienceRecord) => b.createdAt.localeCompare(a.createdAt)
  return [...experiences].sort(
    sort === 'helpful'
      ? (a, b) => (b.data.helpfulCount ?? 0) - (a.data.helpfulCount ?? 0) || newest(a, b)
      : newest,
  )
}
