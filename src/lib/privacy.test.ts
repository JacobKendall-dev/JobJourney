import { describe, expect, it } from 'vitest'
import { MAX_FLAGS, findObviousDetails, mergeFlags, parseFlags, postText } from './privacy'

const reply = (text: string) => ({ content: [{ type: 'text', text }] })

describe('findObviousDetails', () => {
  it('finds emails, links, phone numbers and handles', () => {
    const found = findObviousDetails(
      'Email me at jo.smith@example.com, see https://jo.dev/cv. Call +44 7700 900123 or find me @josmith.',
    )
    expect(found).toEqual([
      { quote: 'jo.smith@example.com', reason: 'Email address' },
      { quote: 'https://jo.dev/cv', reason: 'Link, which could lead back to you' },
      { quote: '+44 7700 900123', reason: 'Phone number' },
      { quote: '@josmith', reason: 'Social media handle' },
    ])
  })

  it('ignores years, salaries, durations and ordinary text', () => {
    expect(
      findObviousDetails('Applied in 2024, offer was 85,000-95,000, 3 rounds over 14 days. Great team at Acme.'),
    ).toEqual([])
  })

  it("doesn't flag an email's domain as a handle", () => {
    expect(findObviousDetails('a@b.io').map((f) => f.reason)).toEqual(['Email address'])
  })
})

describe('mergeFlags', () => {
  it('drops repeated quotes, ignoring case', () => {
    const merged = mergeFlags([{ quote: 'Sarah', reason: 'Name' }], [{ quote: 'sarah', reason: 'Person' }])
    expect(merged).toEqual([{ quote: 'Sarah', reason: 'Name' }])
  })

  it('caps the list', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ quote: `q${i}`, reason: 'r' }))
    expect(mergeFlags(many, [])).toHaveLength(MAX_FLAGS)
  })
})

describe('parseFlags', () => {
  const post = 'My interviewer Sarah Lee asked about graphs.'

  it('reads a JSON array, with or without a code fence', () => {
    const json = '[{"quote":"Sarah Lee","reason":"Named person"}]'
    expect(parseFlags(reply(json), post)).toEqual([{ quote: 'Sarah Lee', reason: 'Named person' }])
    expect(parseFlags(reply('```json\n' + json + '\n```'), post)).toEqual([{ quote: 'Sarah Lee', reason: 'Named person' }])
  })

  it('drops quotes that are not in the post', () => {
    expect(parseFlags(reply('[{"quote":"Bob","reason":"Name"}]'), post)).toEqual([])
  })

  it('gives [] for anything unreadable', () => {
    expect(parseFlags(reply('No issues found.'), post)).toEqual([])
    expect(parseFlags(reply('[{"quote": broken'), post)).toEqual([])
    expect(parseFlags(reply('{"quote":"Sarah Lee"}'), post)).toEqual([])
    expect(parseFlags(null, post)).toEqual([])
    expect(parseFlags({ content: 'x' }, post)).toEqual([])
  })

  it('fills a missing reason', () => {
    expect(parseFlags(reply('[{"quote":"Sarah Lee"}]'), post)).toEqual([{ quote: 'Sarah Lee', reason: 'Could identify someone' }])
  })
})

describe('postText', () => {
  it('joins the non-empty story fields', () => {
    expect(postText({ interviewExperience: 'A', advice: 'B' })).toBe('A\n\nB')
    expect(postText({ interviewExperience: '  ', advice: 'B' })).toBe('B')
    expect(postText({ interviewExperience: 5 })).toBe('')
  })
})
