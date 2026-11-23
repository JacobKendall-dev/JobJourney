/**
 * Validation for the share form, used twice: in the browser for instant
 * feedback, and again inside createExperience / updateExperience, which never
 * trust the browser. Takes `unknown` so a forged request is handled the same
 * as a form.
 */

import { validateNewCompany, type NewCompanyFields } from './companies'
import { INTERVIEW_FORMATS, OUTCOMES, WORK_ARRANGEMENTS, isOneOf, type InterviewFormat, type Outcome, type WorkArrangement } from './options'
import { validateNewPosition, type NewPositionFields } from './positions'

export const STORY_MAX = 2000
export const MAX_STAGES = 10
export const MAX_RESPONSE_DAYS = 365
export const EARLIEST_YEAR = 2000

export interface ExperienceContent {
  appliedMonth: string
  workArrangement?: WorkArrangement
  firstResponseDays?: number
  noResponse: boolean
  interviewStages: number
  interviewFormats: InterviewFormat[]
  outcome: Outcome
  interviewExperience?: string
  advice?: string
  /** "Show my name" — the server sets authorName from the account, never from here. */
  showName: boolean
}

/**
 * Where you applied: an existing company and position, or new ones that
 * createExperience adds when the post is shared (so nothing is added for a
 * form that's abandoned). Exactly one of each pair is set, and a new company
 * always comes with a new position (it has none yet).
 */
export interface ExperiencePlace {
  companyId?: string
  newCompany?: NewCompanyFields
  positionId?: string
  newPosition?: NewPositionFields
}

export interface NewExperience extends ExperienceContent, ExperiencePlace {}

export type ExperienceField = keyof NewExperience | 'story'
export type ExperienceErrors = Partial<Record<ExperienceField, string>>
export type Validated<T> = { ok: true; value: T } | { ok: false; errors: ExperienceErrors }

const ID_RE = /^[A-Za-z0-9_-]{1,100}$/
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

/** "YYYY-MM" for a date's month in UTC. */
export function monthOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * The latest month someone may pick. Uses the earliest time zone (UTC+14), so
 * a person whose new month has already started isn't refused by a server
 * still in the previous month.
 */
export function latestAllowedMonth(now: Date = new Date()): string {
  return monthOf(new Date(now.getTime() + 14 * 60 * 60 * 1000))
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

/** Trim, normalize line endings, and drop empty text. */
function cleanText(value: unknown): string | undefined | null {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') return null
  const text = value.replace(/\r\n?/g, '\n').trim()
  return text ? text : undefined
}

/** Content checks shared by create and update (no company or position). */
export function validateExperienceContent(raw: unknown, now: Date = new Date()): Validated<ExperienceContent> {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const errors: ExperienceErrors = {}

  // When
  const appliedMonth = typeof input.appliedMonth === 'string' ? input.appliedMonth : ''
  const monthMatch = MONTH_RE.exec(appliedMonth)
  if (!monthMatch) errors.appliedMonth = 'Choose the month you applied.'
  else if (Number(monthMatch[1]) < EARLIEST_YEAR) errors.appliedMonth = `Choose a month in ${EARLIEST_YEAR} or later.`
  else if (appliedMonth > latestAllowedMonth(now)) errors.appliedMonth = "The month can't be in the future."

  // Where
  let workArrangement: WorkArrangement | undefined
  if (input.workArrangement !== undefined && input.workArrangement !== null && input.workArrangement !== '') {
    if (isOneOf(WORK_ARRANGEMENTS, input.workArrangement)) workArrangement = input.workArrangement
    else errors.workArrangement = 'Choose Remote, Hybrid or On-site.'
  }

  // First response
  const noResponse = input.noResponse === true
  if (input.noResponse !== undefined && typeof input.noResponse !== 'boolean') {
    errors.noResponse = 'Invalid choice.'
  }
  let firstResponseDays: number | undefined
  const days = input.firstResponseDays
  if (days !== undefined && days !== null && days !== '') {
    if (!isInt(days) || days < 0 || days > MAX_RESPONSE_DAYS) {
      errors.firstResponseDays = `Enter a whole number of days from 0 to ${MAX_RESPONSE_DAYS}.`
    } else if (noResponse) {
      errors.firstResponseDays = 'Leave this empty when there was no response yet.'
    } else {
      firstResponseDays = days
    }
  }

  // Interviews
  const stages = input.interviewStages ?? 0
  if (!isInt(stages) || stages < 0 || stages > MAX_STAGES) {
    errors.interviewStages = `Choose 0 to ${MAX_STAGES} stages.`
  }
  let interviewFormats: InterviewFormat[] = []
  if (input.interviewFormats !== undefined) {
    if (!Array.isArray(input.interviewFormats) || !input.interviewFormats.every((f) => isOneOf(INTERVIEW_FORMATS, f))) {
      errors.interviewFormats = 'Choose from the listed formats.'
    } else {
      // Keep the listed order and drop repeats.
      interviewFormats = INTERVIEW_FORMATS.filter((f) => (input.interviewFormats as unknown[]).includes(f))
    }
  }

  // Outcome
  if (!isOneOf(OUTCOMES, input.outcome)) errors.outcome = 'Choose how it went.'

  // Story
  const interviewExperience = cleanText(input.interviewExperience)
  const advice = cleanText(input.advice)
  if (interviewExperience === null) errors.interviewExperience = 'Invalid text.'
  else if (interviewExperience && interviewExperience.length > STORY_MAX) {
    errors.interviewExperience = `Use ${STORY_MAX.toLocaleString('en-US')} characters or fewer.`
  }
  if (advice === null) errors.advice = 'Invalid text.'
  else if (advice && advice.length > STORY_MAX) errors.advice = `Use ${STORY_MAX.toLocaleString('en-US')} characters or fewer.`
  if (!interviewExperience && !advice && interviewExperience !== null && advice !== null) {
    errors.story = 'Write about the interview, or leave advice for others — at least one.'
  }

  // Post as
  if (input.showName !== undefined && typeof input.showName !== 'boolean') errors.showName = 'Invalid choice.'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      appliedMonth,
      ...(workArrangement ? { workArrangement } : {}),
      ...(firstResponseDays !== undefined ? { firstResponseDays } : {}),
      noResponse,
      interviewStages: stages as number,
      interviewFormats,
      outcome: input.outcome as Outcome,
      ...(interviewExperience ? { interviewExperience } : {}),
      ...(advice ? { advice } : {}),
      showName: input.showName === true,
    },
  }
}

/** Everything createExperience needs: content plus company and position. */
export function validateNewExperience(raw: unknown, now: Date = new Date()): Validated<NewExperience> {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const content = validateExperienceContent(input, now)
  const errors: ExperienceErrors = content.ok ? {} : { ...content.errors }
  const place = validatePlace(input, errors)
  if (!content.ok || !place) return { ok: false, errors }
  return { ok: true, value: { ...place, ...content.value } }
}

const text = (v: unknown) => (typeof v === 'string' ? v : '')
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** The company and position half of validateNewExperience. Adds to `errors`; null if invalid. */
function validatePlace(input: Record<string, unknown>, errors: ExperienceErrors): ExperiencePlace | null {
  const place: ExperiencePlace = {}

  if (isObject(input.newCompany)) {
    const c = input.newCompany
    const checked = validateNewCompany({
      name: text(c.name),
      industry: text(c.industry),
      location: text(c.location),
      website: text(c.website),
    })
    if (checked.ok) place.newCompany = checked.fields
    else errors.companyId = Object.values(checked.errors)[0] ?? "Check the new company's details."
  } else if (typeof input.companyId === 'string' && ID_RE.test(input.companyId)) {
    place.companyId = input.companyId
  } else {
    errors.companyId = 'Choose the company.'
  }

  if (isObject(input.newPosition)) {
    const p = input.newPosition
    const checked = validateNewPosition({ title: text(p.title), level: text(p.level), category: text(p.category) })
    if (checked.ok) place.newPosition = checked.fields
    else errors.positionId = Object.values(checked.errors)[0] ?? "Check the new position's details."
  } else if (typeof input.positionId === 'string' && ID_RE.test(input.positionId) && !place.newCompany) {
    place.positionId = input.positionId
  } else {
    errors.positionId = place.newCompany ? 'Add the position for this new company.' : 'Choose the position.'
  }

  return errors.companyId || errors.positionId ? null : place
}
