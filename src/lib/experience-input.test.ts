import { describe, expect, it } from 'vitest'
import { latestAllowedMonth, monthOf, validateExperienceContent, validateNewExperience } from './experience-input'

const NOW = new Date('2026-11-21T12:00:00Z')

const valid = {
  companyId: 'c1',
  positionId: 'p1',
  appliedMonth: '2026-09',
  interviewStages: 2,
  interviewFormats: ['technical'],
  outcome: 'rejected',
  advice: 'Practice SQL.',
}

const errorsOf = (input: Record<string, unknown>) => {
  const result = validateNewExperience(input, NOW)
  return result.ok ? {} : result.errors
}

describe('months', () => {
  it('uses the earliest time zone for the latest month', () => {
    expect(monthOf(new Date('2026-11-30T23:00:00Z'))).toBe('2026-11')
    // 11:00 UTC on Nov 30 is already Dec 1 in UTC+14.
    expect(latestAllowedMonth(new Date('2026-11-30T11:00:00Z'))).toBe('2026-12')
    expect(latestAllowedMonth(new Date('2026-11-21T12:00:00Z'))).toBe('2026-11')
  })
})

describe('validateNewExperience', () => {
  it('accepts a minimal valid post and tidies it', () => {
    const result = validateNewExperience(
      { ...valid, interviewFormats: ['technical', 'phone_screen', 'technical'], advice: '  Practice SQL.\r\n ' },
      NOW,
    )
    expect(result).toEqual({
      ok: true,
      value: {
        companyId: 'c1',
        positionId: 'p1',
        appliedMonth: '2026-09',
        noResponse: false,
        interviewStages: 2,
        interviewFormats: ['phone_screen', 'technical'],
        outcome: 'rejected',
        advice: 'Practice SQL.',
        showName: false,
      },
    })
  })

  it('needs company, position, month and outcome', () => {
    expect(Object.keys(errorsOf({})).sort()).toEqual(
      ['appliedMonth', 'companyId', 'outcome', 'positionId', 'story'].sort(),
    )
  })

  it('rejects future, malformed and very old months', () => {
    expect(errorsOf({ ...valid, appliedMonth: '2026-12' }).appliedMonth).toMatch(/future/)
    expect(errorsOf({ ...valid, appliedMonth: '2026-13' }).appliedMonth).toBeDefined()
    expect(errorsOf({ ...valid, appliedMonth: '1999-05' }).appliedMonth).toMatch(/2000/)
    expect(errorsOf({ ...valid, appliedMonth: '2026-11' }).appliedMonth).toBeUndefined()
  })

  it('checks first response and "no response yet" together', () => {
    expect(errorsOf({ ...valid, firstResponseDays: 366 }).firstResponseDays).toBeDefined()
    expect(errorsOf({ ...valid, firstResponseDays: 2.5 }).firstResponseDays).toBeDefined()
    expect(errorsOf({ ...valid, firstResponseDays: '5' }).firstResponseDays).toBeDefined()
    expect(errorsOf({ ...valid, firstResponseDays: 5, noResponse: true }).firstResponseDays).toMatch(/empty/)
    expect(errorsOf({ ...valid, noResponse: true })).toEqual({})
    expect(errorsOf({ ...valid, noResponse: 'yes' }).noResponse).toBeDefined()
  })

  it('checks stages, formats, arrangement and outcome against their lists', () => {
    expect(errorsOf({ ...valid, interviewStages: 11 }).interviewStages).toBeDefined()
    expect(errorsOf({ ...valid, interviewStages: -1 }).interviewStages).toBeDefined()
    expect(errorsOf({ ...valid, interviewFormats: ['lunch'] }).interviewFormats).toBeDefined()
    expect(errorsOf({ ...valid, interviewFormats: 'technical' }).interviewFormats).toBeDefined()
    expect(errorsOf({ ...valid, workArrangement: 'moon' }).workArrangement).toBeDefined()
    expect(errorsOf({ ...valid, workArrangement: '' })).toEqual({})
    expect(errorsOf({ ...valid, outcome: 'hired' }).outcome).toBeDefined()
  })

  it('needs at least one story field, each within 2,000 characters', () => {
    expect(errorsOf({ ...valid, advice: '   ', interviewExperience: '' }).story).toBeDefined()
    expect(errorsOf({ ...valid, advice: 'x'.repeat(2001) }).advice).toBeDefined()
    expect(errorsOf({ ...valid, advice: 'x'.repeat(2000) })).toEqual({})
    expect(errorsOf({ ...valid, advice: 42 }).advice).toBeDefined()
  })

  it('rejects ids that are not plain ids', () => {
    expect(errorsOf({ ...valid, companyId: '../x' }).companyId).toBeDefined()
    expect(errorsOf({ ...valid, positionId: '' }).positionId).toBeDefined()
  })

  it('handles junk input without throwing', () => {
    expect(validateExperienceContent(null, NOW).ok).toBe(false)
    expect(validateNewExperience('nope', NOW).ok).toBe(false)
  })
})
