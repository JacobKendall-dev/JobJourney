/**
 * The shape of an experience record's data, and the display helpers every
 * page uses. The `experiences` schema itself is added with `createExperience`
 * (see the build order); it will import this type.
 *
 * Experiences never hold an author id. `createdBy` on the record is the app
 * owner, because actions write experiences under the owner's identity.
 */

import { isTrue, type InterviewFormat, type Outcome, type WorkArrangement } from './options'

export interface Experience {
  companyId: string
  positionId: string
  /** Stored as 0 / 1. Read with `isTrue`. */
  isAnonymous: 0 | 1 | boolean
  /** Only set when the author chose to show their name. */
  authorName?: string
  /** YYYY-MM */
  appliedMonth: string
  /** Empty when the author didn't say, or when `noResponse` is true. */
  firstResponseDays?: number
  /** Stored as 0 / 1. True means "no response yet". */
  noResponse?: 0 | 1 | boolean
  interviewStages: number
  /** A `json` column, so it reads back as an array. */
  interviewFormats: (InterviewFormat | string)[]
  outcome: Outcome | string
  /** Optional: Remote, Hybrid or On-site. Display with `labelFor(WORK_ARRANGEMENTS, …)`. */
  workArrangement?: WorkArrangement | string
  interviewExperience?: string
  advice?: string
  helpfulCount: number
  commentCount: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * "2026-09" → "Sep 2026". Built from the text rather than `new Date()`,
 * which reads "2026-09" as UTC midnight and shows August west of UTC.
 */
export function formatMonth(value: string | undefined): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '')
  const month = match ? Number(match[2]) : 0
  return match && month >= 1 && month <= 12 ? `${MONTHS[month - 1]} ${match[1]}` : ''
}

/** "8 days", "1 day", "Same day", "No response yet", or undefined when not given. */
export function firstResponseText(
  experience: Pick<Experience, 'firstResponseDays' | 'noResponse'>,
): string | undefined {
  if (isTrue(experience.noResponse)) return 'No response yet'
  const days = experience.firstResponseDays
  if (typeof days !== 'number' || !Number.isFinite(days) || days < 0) return undefined
  if (days === 0) return 'Same day'
  return days === 1 ? '1 day' : `${days} days`
}

/** "1 stage", "3 stages", "No interviews". */
export function stagesText(stages: number | undefined): string | undefined {
  if (typeof stages !== 'number' || !Number.isFinite(stages) || stages < 0) return undefined
  if (stages === 0) return 'No interviews'
  return stages === 1 ? '1 stage' : `${stages} stages`
}

/** The text shown as a card's excerpt: advice first, else the interview story. */
export function excerptSource(experience: Pick<Experience, 'advice' | 'interviewExperience'>): string {
  return (experience.advice?.trim() || experience.interviewExperience?.trim() || '').replace(/\s+/g, ' ')
}

/** "Shared anonymously" or "Shared by {name}". */
export function bylineText(experience: Pick<Experience, 'isAnonymous' | 'authorName'>): string {
  const name = experience.authorName?.trim()
  return !isTrue(experience.isAnonymous) && name ? `Shared by ${name}` : 'Shared anonymously'
}
