import { describe, expect, it } from 'vitest'
import type { Experience } from './experience'
import { companyStats, countBy, median, sortExperiences, type ExperienceRecord } from './stats'

let n = 0
const exp = (data: Partial<Experience>, createdAt = `2026-01-0${++n}`): ExperienceRecord => ({
  recordId: `e${n}`,
  createdBy: 'owner',
  createdAt,
  updatedAt: createdAt,
  data: {
    companyId: 'c1',
    positionId: 'p1',
    isAnonymous: 1,
    appliedMonth: '2026-01',
    interviewStages: 2,
    interviewFormats: [],
    outcome: 'offer',
    helpfulCount: 0,
    commentCount: 0,
    ...data,
  },
})

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeUndefined()
  })
})

describe('countBy', () => {
  it('counts per company and position', () => {
    const list = [exp({ companyId: 'a', positionId: 'x' }), exp({ companyId: 'a', positionId: 'y' }), exp({ companyId: 'b' })]
    expect(countBy(list, 'companyId')).toEqual(new Map([['a', 2], ['b', 1]]))
    expect(countBy(list, 'positionId').get('x')).toBe(1)
  })
})

describe('companyStats', () => {
  it('summarizes outcomes, first response and stages', () => {
    const stats = companyStats([
      exp({ outcome: 'offer', firstResponseDays: 4, interviewStages: 3 }),
      exp({ outcome: 'rejected', firstResponseDays: 10, interviewStages: 1 }),
      exp({ outcome: 'ghosted', noResponse: 1, firstResponseDays: undefined, interviewStages: 0 }),
      exp({ outcome: 'offer', interviewStages: 2 }),
    ])
    expect(stats.count).toBe(4)
    expect(stats.outcomes).toEqual({ offer: 2, rejected: 1, ghosted: 1, withdrew: 0, in_progress: 0 })
    expect(stats.medianFirstResponseDays).toBe(7) // ignores "no response yet" and unanswered
    expect(stats.medianStages).toBe(1.5)
  })

  it('is empty-safe', () => {
    const stats = companyStats([])
    expect(stats.count).toBe(0)
    expect(stats.medianFirstResponseDays).toBeUndefined()
  })
})

describe('sortExperiences', () => {
  it('sorts newest first, or most helpful with newest breaking ties', () => {
    const a = exp({ helpfulCount: 5 }, '2026-01-01')
    const b = exp({ helpfulCount: 9 }, '2026-01-02')
    const c = exp({ helpfulCount: 5 }, '2026-01-03')
    expect(sortExperiences([a, b, c], 'newest').map((e) => e.recordId)).toEqual([c, b, a].map((e) => e.recordId))
    expect(sortExperiences([a, b, c], 'helpful').map((e) => e.recordId)).toEqual([b, c, a].map((e) => e.recordId))
  })
})
