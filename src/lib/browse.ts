/**
 * Browse filtering, done in the browser over the full live experiences list.
 * Pure (no hooks), so it can be unit tested.
 *
 * Why the browser: queries only match exact values, sort by one field, and
 * have no offset or total — so "contains", industry (a field on the company),
 * text search, an accurate count and "Load more" all happen here.
 */

import type { ExperienceFilters } from './filters'
import type { CompanyRecord, Lookups } from './lookups'
import { INDUSTRIES, isOneOf } from './options'
import { sortExperiences, type ExperienceRecord } from './stats'

export const PAGE_SIZE = 20

/** Company id for a slug from the URL; null when the slug matches no company. */
function companyIdForSlug(lookups: Pick<Lookups, 'companyBySlug'>, slug: string | undefined) {
  if (!slug) return undefined
  return lookups.companyBySlug.get(slug)?.recordId ?? null
}

function matchesIndustry(company: CompanyRecord | undefined, industry: string): boolean {
  if (!company) return false
  const value = company.data.industry
  // Values outside the list display as "Other", so they filter as Other too.
  return value === industry || (industry === 'other' && !isOneOf(INDUSTRIES, value))
}

export function filterExperiences(
  experiences: ExperienceRecord[],
  filters: ExperienceFilters,
  lookups: Pick<Lookups, 'companyBySlug' | 'companyById' | 'positionById'>,
): ExperienceRecord[] {
  const companyId = companyIdForSlug(lookups, filters.company)
  // A company slug that matches nothing filters to nothing, not to everything.
  if (companyId === null) return []

  const q = filters.q?.trim().toLowerCase()

  const matched = experiences.filter(({ data }) => {
    if (companyId && data.companyId !== companyId) return false
    if (filters.position && data.positionId !== filters.position) return false
    if (filters.outcome && data.outcome !== filters.outcome) return false
    if (filters.arrangement && data.workArrangement !== filters.arrangement) return false
    if (filters.month && data.appliedMonth !== filters.month) return false
    if (filters.format) {
      const formats = Array.isArray(data.interviewFormats) ? data.interviewFormats : []
      if (!formats.includes(filters.format)) return false
    }
    const company = lookups.companyById.get(data.companyId)
    if (filters.industry && !matchesIndustry(company, filters.industry)) return false
    if (q) {
      const position = lookups.positionById.get(data.positionId)
      const haystack = `${company?.data.name ?? ''} ${position?.data.title ?? ''}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  return sortExperiences(matched, filters.sort)
}

/** Distinct applied months, newest first, for the month filter. */
export function appliedMonths(experiences: ExperienceRecord[]): string[] {
  const months = new Set<string>()
  for (const { data } of experiences) if (data.appliedMonth) months.add(data.appliedMonth)
  return [...months].sort().reverse()
}

/** "1 experience", "24 experiences". */
export function experienceCount(n: number): string {
  return `${n} ${n === 1 ? 'experience' : 'experiences'}`
}
