import { describe, expect, it } from 'vitest'
import { bylineText, excerptSource, firstResponseText, formatMonth, stagesText } from './experience'

describe('formatMonth', () => {
  it('formats YYYY-MM without timezone drift', () => {
    expect(formatMonth('2026-09')).toBe('Sep 2026')
    expect(formatMonth('2026-01')).toBe('Jan 2026')
    expect(formatMonth('2025-12')).toBe('Dec 2025')
  })

  it('returns empty for malformed values', () => {
    for (const bad of ['2026-13', '2026-00', '2026-9', 'Sep 2026', '', undefined]) {
      expect(formatMonth(bad)).toBe('')
    }
  })
})

describe('firstResponseText', () => {
  it('describes days, same day and no response', () => {
    expect(firstResponseText({ firstResponseDays: 8 })).toBe('8 days')
    expect(firstResponseText({ firstResponseDays: 1 })).toBe('1 day')
    expect(firstResponseText({ firstResponseDays: 0 })).toBe('Same day')
    expect(firstResponseText({ noResponse: 1 })).toBe('No response yet')
    expect(firstResponseText({ noResponse: true, firstResponseDays: 5 })).toBe('No response yet')
  })

  it('is undefined when the author didn’t say', () => {
    expect(firstResponseText({})).toBeUndefined()
    expect(firstResponseText({ noResponse: 0 })).toBeUndefined()
    expect(firstResponseText({ firstResponseDays: -1 })).toBeUndefined()
  })
})

describe('stagesText', () => {
  it('pluralizes and names zero', () => {
    expect(stagesText(0)).toBe('No interviews')
    expect(stagesText(1)).toBe('1 stage')
    expect(stagesText(3)).toBe('3 stages')
    expect(stagesText(undefined)).toBeUndefined()
  })
})

describe('excerptSource', () => {
  it('prefers advice, falls back to the interview story, and flattens line breaks', () => {
    expect(excerptSource({ advice: 'Be ready\n\nfor SQL', interviewExperience: 'x' })).toBe('Be ready for SQL')
    expect(excerptSource({ advice: '   ', interviewExperience: 'Two rounds' })).toBe('Two rounds')
    expect(excerptSource({})).toBe('')
  })
})

describe('bylineText', () => {
  it('shows a name only when the author chose to', () => {
    expect(bylineText({ isAnonymous: 0, authorName: 'Sam' })).toBe('Shared by Sam')
    expect(bylineText({ isAnonymous: 1, authorName: 'Sam' })).toBe('Shared anonymously')
    expect(bylineText({ isAnonymous: 0, authorName: '  ' })).toBe('Shared anonymously')
  })
})
