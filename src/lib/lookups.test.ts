import { describe, expect, it } from 'vitest'
import { buildLookups, type CompanyRecord, type PositionRecord } from './lookups'

const meta = { createdBy: 'u', createdAt: '', updatedAt: '' }
const company = (id: string, name: string, slug: string): CompanyRecord => ({
  recordId: id,
  data: { name, slug, industry: 'technology', verified: 0 },
  ...meta,
})
const position = (id: string, companyId: string, title: string): PositionRecord => ({
  recordId: id,
  data: { companyId, title, level: 'intern', category: 'software' },
  ...meta,
})

describe('buildLookups', () => {
  const lookups = buildLookups(
    [company('c2', 'zeta labs', 'zeta-labs'), company('c1', 'Acme', 'acme')],
    [position('p2', 'c1', 'Data Intern'), position('p1', 'c1', 'analyst'), position('p3', 'c2', 'SWE')],
  )

  it('sorts companies and positions A–Z, ignoring case', () => {
    expect(lookups.companies.map((c) => c.data.name)).toEqual(['Acme', 'zeta labs'])
    expect(lookups.positions.map((p) => p.data.title)).toEqual(['analyst', 'Data Intern', 'SWE'])
  })

  it('finds companies by id and by slug', () => {
    expect(lookups.companyById.get('c1')?.data.slug).toBe('acme')
    expect(lookups.companyBySlug.get('zeta-labs')?.recordId).toBe('c2')
    expect(lookups.companyBySlug.get('missing')).toBeUndefined()
  })

  it("groups each company's positions", () => {
    expect(lookups.positionsByCompany.get('c1')?.map((p) => p.recordId)).toEqual(['p1', 'p2'])
    expect(lookups.positionsByCompany.get('c2')?.map((p) => p.recordId)).toEqual(['p3'])
    expect(lookups.positionById.get('p3')?.data.title).toBe('SWE')
  })
})
