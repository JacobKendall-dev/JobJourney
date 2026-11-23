/**
 * The admin page's lists, worked out from the live companies, positions and
 * experiences. Pure, so it can be unit tested without a record room.
 */

import type { CompanyRecord, PositionRecord } from './lookups'
import { isTrue } from './options'
import { sortExperiences, type ExperienceRecord } from './stats'

export interface AdminPosition {
  position: PositionRecord
  /** Undefined when the position's company no longer exists. */
  company?: CompanyRecord
  /** How many experiences use this position. */
  uses: number
}

export interface AdminView {
  /** Unverified companies, oldest added first (a queue). */
  unverified: CompanyRecord[]
  /** Companies no experience uses, A–Z: candidates for cleanup. */
  unused: CompanyRecord[]
  /** All experiences, newest first. */
  recent: ExperienceRecord[]
  /**
   * Positions sorted by company name, then title. Positions whose company is
   * missing (strays) come first, so they're easy to spot.
   */
  positions: AdminPosition[]
  /** How many positions no experience uses. */
  unusedPositionCount: number
}

const byText = (a: string | undefined, b: string | undefined) =>
  (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' })

/**
 * `companies` and `positions` are expected A–Z, as `buildLookups` returns them.
 */
export function buildAdminView(
  companies: CompanyRecord[],
  positions: PositionRecord[],
  experiences: ExperienceRecord[],
): AdminView {
  const companyUses = new Map<string, number>()
  const positionUses = new Map<string, number>()
  for (const { data } of experiences) {
    companyUses.set(data.companyId, (companyUses.get(data.companyId) ?? 0) + 1)
    positionUses.set(data.positionId, (positionUses.get(data.positionId) ?? 0) + 1)
  }

  const companyById = new Map(companies.map((c) => [c.recordId, c]))

  const unverified = companies
    .filter((c) => !isTrue(c.data.verified))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const unused = companies.filter((c) => !companyUses.has(c.recordId))

  const adminPositions = positions
    .map((position) => ({
      position,
      company: companyById.get(position.data.companyId),
      uses: positionUses.get(position.recordId) ?? 0,
    }))
    .sort(
      (a, b) =>
        Number(!!a.company) - Number(!!b.company) ||
        byText(a.company?.data.name, b.company?.data.name) ||
        byText(a.position.data.title, b.position.data.title),
    )

  return {
    unverified,
    unused,
    recent: sortExperiences(experiences, 'newest'),
    positions: adminPositions,
    unusedPositionCount: adminPositions.filter((p) => p.uses === 0).length,
  }
}
