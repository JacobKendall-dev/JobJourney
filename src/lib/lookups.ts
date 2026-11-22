/**
 * Pure lookup tables built from the companies and positions records. Kept
 * separate from the hook so it can be unit tested without a record room.
 */

import type { RecordData } from 'deepspace'
import type { Company } from '../schemas/companies-schema'
import type { Position } from '../schemas/positions-schema'

export type CompanyRecord = RecordData<Company>
export type PositionRecord = RecordData<Position>

export interface Lookups {
  /** All companies, A–Z by name (case-insensitive). */
  companies: CompanyRecord[]
  /** All positions, A–Z by title. */
  positions: PositionRecord[]
  companyById: Map<string, CompanyRecord>
  /** URLs use the slug; records store the id. */
  companyBySlug: Map<string, CompanyRecord>
  positionById: Map<string, PositionRecord>
  /** Each company's positions, A–Z by title. Companies with none are absent. */
  positionsByCompany: Map<string, PositionRecord[]>
}

const byText = (a: string | undefined, b: string | undefined) =>
  (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' })

export function buildLookups(companies: CompanyRecord[], positions: PositionRecord[]): Lookups {
  const sortedCompanies = [...companies].sort((a, b) => byText(a.data.name, b.data.name))
  const sortedPositions = [...positions].sort((a, b) => byText(a.data.title, b.data.title))

  const companyById = new Map<string, CompanyRecord>()
  const companyBySlug = new Map<string, CompanyRecord>()
  for (const company of sortedCompanies) {
    companyById.set(company.recordId, company)
    if (company.data.slug) companyBySlug.set(company.data.slug, company)
  }

  const positionById = new Map<string, PositionRecord>()
  const positionsByCompany = new Map<string, PositionRecord[]>()
  for (const position of sortedPositions) {
    positionById.set(position.recordId, position)
    const list = positionsByCompany.get(position.data.companyId)
    if (list) list.push(position)
    else positionsByCompany.set(position.data.companyId, [position])
  }

  return {
    companies: sortedCompanies,
    positions: sortedPositions,
    companyById,
    companyBySlug,
    positionById,
    positionsByCompany,
  }
}
