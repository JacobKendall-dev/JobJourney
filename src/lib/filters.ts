/**
 * Experience filters <-> URL search params. Pure, so it can be unit tested.
 *
 * URL keys: company (slug), position (id), outcome, industry, format,
 * month (YYYY-MM), q (text), sort (newest | helpful). Unknown or malformed
 * values are dropped, so a hand-edited URL can't put the page in a bad state.
 */

import {
  INDUSTRIES,
  INTERVIEW_FORMATS,
  OUTCOMES,
  isOneOf,
  type Industry,
  type InterviewFormat,
  type Outcome,
} from './options'

export const SORTS = ['newest', 'helpful'] as const
export type Sort = (typeof SORTS)[number]
export const DEFAULT_SORT: Sort = 'newest'

/** Longest text search kept from the URL. */
export const MAX_QUERY_LENGTH = 100

export interface ExperienceFilters {
  /** Company slug (the page looks up its id). */
  company?: string
  /** Position record id. */
  position?: string
  outcome?: Outcome
  industry?: Industry
  format?: InterviewFormat
  /** YYYY-MM */
  month?: string
  /** Text matched against company and position names. */
  q?: string
  sort: Sort
}

/** The filter keys (everything except sort). */
export const FILTER_KEYS = ['company', 'position', 'outcome', 'industry', 'format', 'month', 'q'] as const
export type FilterKey = (typeof FILTER_KEYS)[number]

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
/** Slugs and record ids: letters, digits, dashes and underscores. */
const ID_RE = /^[A-Za-z0-9_-]{1,100}$/

function clean(value: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function parseFilters(params: URLSearchParams): ExperienceFilters {
  const company = clean(params.get('company'))
  const position = clean(params.get('position'))
  const outcome = clean(params.get('outcome'))
  const industry = clean(params.get('industry'))
  const format = clean(params.get('format'))
  const month = clean(params.get('month'))
  const q = clean(params.get('q'))?.slice(0, MAX_QUERY_LENGTH)
  const sort = clean(params.get('sort'))

  return {
    company: company && ID_RE.test(company) ? company : undefined,
    position: position && ID_RE.test(position) ? position : undefined,
    outcome: isOneOf(OUTCOMES, outcome) ? outcome : undefined,
    industry: isOneOf(INDUSTRIES, industry) ? industry : undefined,
    format: isOneOf(INTERVIEW_FORMATS, format) ? format : undefined,
    month: month && MONTH_RE.test(month) ? month : undefined,
    q,
    sort: isOneOf(SORTS, sort) ? sort : DEFAULT_SORT,
  }
}

/** Only the set filters, and sort only when it isn't the default, in a stable order. */
export function toSearchParams(filters: ExperienceFilters): URLSearchParams {
  const params = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    const value = filters[key]
    if (value) params.set(key, value)
  }
  if (filters.sort !== DEFAULT_SORT) params.set('sort', filters.sort)
  return params
}

/** How many filters are on (sort doesn't count). */
export function activeFilterCount(filters: ExperienceFilters): number {
  return FILTER_KEYS.filter((key) => filters[key]).length
}
