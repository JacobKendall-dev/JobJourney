import { describe, expect, it } from 'vitest'
import { countNewComments, digestEmail } from './digest'

const comment = (createdAt: string, experienceId: string, extra: Record<string, unknown> = {}) => ({
  createdAt,
  data: { experienceId, ...extra },
})

describe('countNewComments', () => {
  const since = '2026-11-22T09:00:00.000Z'
  const until = '2026-11-23T09:00:00.000Z'

  it('counts comments in the window per experience', () => {
    const counts = countNewComments(
      [
        comment('2026-11-22T10:00:00.000Z', 'e1'),
        comment('2026-11-23T08:00:00.000Z', 'e1'),
        comment('2026-11-22T12:00:00.000Z', 'e2'),
        comment('2026-11-22T09:00:00.000Z', 'e3'), // exactly at `since`: counted last run
        comment('2026-11-21T10:00:00.000Z', 'e3'),
        comment('2026-11-23T09:30:00.000Z', 'e3'), // after this run: next run
      ],
      since,
      until,
    )
    expect(Object.fromEntries(counts)).toEqual({ e1: 2, e2: 1 })
  })

  it("skips deleted comments and the author's own", () => {
    const counts = countNewComments(
      [
        comment('2026-11-22T10:00:00.000Z', 'e1', { deleted: 1 }),
        comment('2026-11-22T10:00:00.000Z', 'e1', { byAuthor: true }),
      ],
      since,
      until,
    )
    expect(counts.size).toBe(0)
  })
})

describe('digestEmail', () => {
  const email = digestEmail(
    [
      { experienceId: 'e1', title: 'Engineer at <Acme>', count: 2 },
      { experienceId: 'e2', title: 'Your experience', count: 1 },
    ],
    'https://jobjourney.app.space',
  )

  it('totals the comments in the subject', () => {
    expect(email.subject).toBe('3 new comments on your JobJourney posts')
  })

  it('links each post and Settings', () => {
    expect(email.text).toContain('- Engineer at <Acme>: 2 new comments\n  https://jobjourney.app.space/experiences/e1')
    expect(email.text).toContain('Your experience: 1 new comment\n')
    expect(email.text).toContain('https://jobjourney.app.space/settings')
  })

  it('escapes names in the HTML', () => {
    expect(email.html).toContain('Engineer at &lt;Acme&gt;')
    expect(email.html).not.toContain('<Acme>')
  })
})
