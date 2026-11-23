import { describe, expect, it } from 'vitest'
import { buildAdminView } from './admin'
import type { CompanyRecord, PositionRecord } from './lookups'
import type { ExperienceRecord } from './stats'

const at = (day: number) => `2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z`

const company = (id: string, name: string, verified: 0 | 1, day: number) =>
  ({ recordId: id, createdAt: at(day), updatedAt: at(day), data: { name, slug: id, industry: 'technology', verified } }) as unknown as CompanyRecord

const position = (id: string, companyId: string, title: string) =>
  ({ recordId: id, createdAt: at(1), updatedAt: at(1), data: { companyId, title, level: 'entry', category: 'engineering' } }) as unknown as PositionRecord

const experience = (id: string, companyId: string, positionId: string, day: number) =>
  ({ recordId: id, createdAt: at(day), updatedAt: at(day), data: { companyId, positionId } }) as unknown as ExperienceRecord

// A–Z, as buildLookups returns them.
const companies = [company('a', 'Acme', 0, 5), company('b', 'Beta', 1, 1), company('c', 'Cobalt', 0, 2)]
const positions = [
  position('p1', 'a', 'Analyst'),
  position('p2', 'b', 'Designer'),
  position('p3', 'gone', 'Engineer'),
  position('p4', 'a', 'Intern'),
]
const experiences = [experience('e1', 'a', 'p1', 3), experience('e2', 'a', 'p1', 9), experience('e3', 'b', 'p2', 6)]

describe('buildAdminView', () => {
  const view = buildAdminView(companies, positions, experiences)

  it('queues unverified companies oldest first', () => {
    expect(view.unverified.map((c) => c.recordId)).toEqual(['c', 'a'])
  })

  it('lists companies no experience uses', () => {
    expect(view.unused.map((c) => c.recordId)).toEqual(['c'])
  })

  it('lists experiences newest first', () => {
    expect(view.recent.map((e) => e.recordId)).toEqual(['e2', 'e3', 'e1'])
  })

  it('counts position uses and puts positions with a missing company first', () => {
    expect(view.positions.map((p) => [p.position.recordId, p.uses, p.company?.recordId])).toEqual([
      ['p3', 0, undefined],
      ['p1', 2, 'a'],
      ['p4', 0, 'a'],
      ['p2', 1, 'b'],
    ])
    expect(view.unusedPositionCount).toBe(2)
  })

  it('handles empty data', () => {
    expect(buildAdminView([], [], [])).toEqual({
      unverified: [],
      unused: [],
      recent: [],
      positions: [],
      unusedPositionCount: 0,
    })
  })
})
