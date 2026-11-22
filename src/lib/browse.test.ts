import { describe, expect, it } from 'vitest'
import { appliedMonths, experienceCount, filterExperiences } from './browse'
import { parseFilters } from './filters'
import type { Experience } from './experience'
import { buildLookups, type CompanyRecord, type PositionRecord } from './lookups'
import type { ExperienceRecord } from './stats'

const meta = { createdBy: 'owner', updatedAt: '' }
const company = (id: string, name: string, slug: string, industry: string): CompanyRecord => ({
  recordId: id,
  data: { name, slug, industry, verified: 0 },
  createdAt: '',
  ...meta,
})
const position = (id: string, companyId: string, title: string): PositionRecord => ({
  recordId: id,
  data: { companyId, title, level: 'intern', category: 'software' },
  createdAt: '',
  ...meta,
})
const exp = (id: string, createdAt: string, data: Partial<Experience>): ExperienceRecord => ({
  recordId: id,
  createdAt,
  ...meta,
  data: {
    companyId: 'acme',
    positionId: 'acme-swe',
    isAnonymous: 1,
    appliedMonth: '2026-01',
    interviewStages: 1,
    interviewFormats: [],
    outcome: 'offer',
    helpfulCount: 0,
    commentCount: 0,
    ...data,
  },
})

const lookups = buildLookups(
  [
    company('acme', 'Acme Robotics', 'acme-robotics', 'technology'),
    company('bank', 'Sample Bank', 'sample-bank', 'finance'),
    company('odd', 'Odd Co', 'odd-co', 'space-mining'),
  ],
  [position('acme-swe', 'acme', 'Software Intern'), position('acme-data', 'acme', 'Data Analyst'), position('bank-sec', 'bank', 'Security Intern')],
)

const all = [
  exp('e1', '2026-03-01', { helpfulCount: 2, interviewFormats: ['technical', 'phone_screen'], workArrangement: 'remote' }),
  exp('e2', '2026-03-05', { positionId: 'acme-data', outcome: 'ghosted', appliedMonth: '2026-02', helpfulCount: 9 }),
  exp('e3', '2026-03-03', { companyId: 'bank', positionId: 'bank-sec', outcome: 'rejected', workArrangement: 'on_site' }),
  exp('e4', '2026-03-04', { companyId: 'odd', positionId: 'x', outcome: 'withdrew' }),
]

const run = (query: string) => filterExperiences(all, parseFilters(new URLSearchParams(query)), lookups).map((e) => e.recordId)

describe('filterExperiences', () => {
  it('returns everything newest first with no filters', () => {
    expect(run('')).toEqual(['e2', 'e4', 'e3', 'e1'])
  })

  it('sorts by most helpful', () => {
    expect(run('sort=helpful')).toEqual(['e2', 'e1', 'e4', 'e3'])
  })

  it('filters by company slug, and a slug that matches nothing returns nothing', () => {
    expect(run('company=acme-robotics')).toEqual(['e2', 'e1'])
    expect(run('company=no-such-company')).toEqual([])
  })

  it('filters by position, outcome, arrangement and month', () => {
    expect(run('position=acme-data')).toEqual(['e2'])
    expect(run('outcome=rejected')).toEqual(['e3'])
    expect(run('arrangement=remote')).toEqual(['e1'])
    expect(run('month=2026-02')).toEqual(['e2'])
  })

  it('filters by interview format ("contains")', () => {
    expect(run('format=phone_screen')).toEqual(['e1'])
  })

  it('filters by the company’s industry, with unknown industries counting as Other', () => {
    expect(run('industry=finance')).toEqual(['e3'])
    expect(run('industry=other')).toEqual(['e4'])
  })

  it('searches company and position names, ignoring case', () => {
    expect(run('q=intern')).toEqual(['e3', 'e1'])
    expect(run('q=SAMPLE')).toEqual(['e3'])
    expect(run('q=analyst')).toEqual(['e2'])
    expect(run('q=nothing-like-this')).toEqual([])
  })

  it('combines filters', () => {
    expect(run('company=acme-robotics&outcome=offer&q=software')).toEqual(['e1'])
  })
})

describe('appliedMonths and experienceCount', () => {
  it('lists distinct months newest first', () => {
    expect(appliedMonths(all)).toEqual(['2026-02', '2026-01'])
  })

  it('pluralizes', () => {
    expect(experienceCount(1)).toBe('1 experience')
    expect(experienceCount(24)).toBe('24 experiences')
  })
})
