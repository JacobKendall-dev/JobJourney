import { describe, expect, it } from 'vitest'
import { activeFilterCount, parseFilters, toSearchParams } from './filters'

const parse = (query: string) => parseFilters(new URLSearchParams(query))

describe('parseFilters', () => {
  it('reads every filter from the URL', () => {
    expect(
      parse(
        'company=example-technologies&position=pos_1&outcome=offer&industry=finance&format=take_home&arrangement=on_site&month=2026-09&q=intern&sort=helpful',
      ),
    ).toEqual({
      company: 'example-technologies',
      position: 'pos_1',
      outcome: 'offer',
      industry: 'finance',
      format: 'take_home',
      arrangement: 'on_site',
      month: '2026-09',
      q: 'intern',
      sort: 'helpful',
    })
  })

  it('defaults to newest with no filters', () => {
    expect(parse('')).toEqual({
      company: undefined,
      position: undefined,
      outcome: undefined,
      industry: undefined,
      format: undefined,
      arrangement: undefined,
      month: undefined,
      q: undefined,
      sort: 'newest',
    })
  })

  it('drops unknown and malformed values', () => {
    const filters = parse(
      'company=../etc&position=a%20b&outcome=hired&industry=space&format=lunch&arrangement=moon&month=2026-13&sort=oldest',
    )
    expect(filters).toMatchObject({
      arrangement: undefined,
      company: undefined,
      position: undefined,
      outcome: undefined,
      industry: undefined,
      format: undefined,
      month: undefined,
      sort: 'newest',
    })
  })

  it('trims text search and caps its length', () => {
    expect(parse('q=%20%20intern%20%20').q).toBe('intern')
    expect(parse('q=%20%20').q).toBeUndefined()
    expect(parse(`q=${'a'.repeat(300)}`).q).toHaveLength(100)
  })
})

describe('toSearchParams', () => {
  it('writes only set filters, and sort only when not the default', () => {
    expect(toSearchParams({ outcome: 'offer', q: 'intern', sort: 'newest' }).toString()).toBe(
      'outcome=offer&q=intern',
    )
    expect(toSearchParams({ sort: 'helpful' }).toString()).toBe('sort=helpful')
  })

  it('round-trips through parseFilters', () => {
    const query = 'company=acme&outcome=ghosted&month=2026-01&q=data&sort=helpful'
    expect(toSearchParams(parse(query)).toString()).toBe(query)
  })
})

describe('activeFilterCount', () => {
  it('counts filters but not sort', () => {
    expect(activeFilterCount(parse('sort=helpful'))).toBe(0)
    expect(activeFilterCount(parse('outcome=offer&q=intern&sort=helpful'))).toBe(2)
  })
})
