/**
 * Server-renders the step 3 components to check what reaches the page:
 * plain-text user content, linking rules, badge words and empty-state actions.
 */

import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui'
import type { Experience } from '@/lib/experience'
import { EmptyState } from './EmptyState'
import { ExperienceCard } from './ExperienceCard'
import { OutcomeBadge } from './OutcomeBadge'
import { VerifiedBadge } from './VerifiedBadge'

const render = (element: ReactElement) =>
  renderToString(
    <MemoryRouter>
      <TooltipProvider>{element}</TooltipProvider>
    </MemoryRouter>,
  )

const experience: Experience = {
  companyId: 'c1',
  positionId: 'p1',
  isAnonymous: 1,
  appliedMonth: '2026-09',
  firstResponseDays: 8,
  noResponse: 0,
  interviewStages: 3,
  interviewFormats: ['technical', 'take_home'],
  outcome: 'offer',
  advice: '<img src=x onerror=alert(1)> Practice SQL',
  helpfulCount: 1,
  commentCount: 2,
}

describe('ExperienceCard', () => {
  const html = render(
    <ExperienceCard
      id="exp_1"
      experience={experience}
      company={{ name: 'Acme', verified: 1 }}
      position={{ title: 'Data Intern' }}
    />,
  )

  it('shows the summary facts', () => {
    expect(html).toContain('Data Intern')
    expect(html).toContain('Acme')
    expect(html).toContain('Applied Sep 2026')
    expect(html).toContain('First response: 8 days')
    expect(html).toContain('3 stages')
    expect(html).toContain('Technical')
    expect(html).toContain('Take-home')
    expect(html).toContain('1 helpful vote')
    expect(html).toContain('2 comments')
  })

  it('renders user text as plain text, never HTML', () => {
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; Practice SQL')
  })

  it('links to the detail page when it has an id', () => {
    expect(html).toContain('href="/experiences/exp_1"')
  })

  it('has no link in preview mode, and handles missing names', () => {
    const preview = render(<ExperienceCard experience={experience} />)
    expect(preview).not.toContain('href=')
    expect(preview).toContain('Unknown position')
    expect(preview).toContain('Unknown company')
  })

  it('shows the work arrangement only when it is a known choice', () => {
    expect(render(<ExperienceCard experience={{ ...experience, workArrangement: 'on_site' }} />)).toContain('On-site')
    const unknown = render(<ExperienceCard experience={{ ...experience, workArrangement: 'moon' }} />)
    expect(unknown).not.toContain('moon')
  })

  it('shows "No response yet" and hides empty sections', () => {
    const quiet = render(
      <ExperienceCard
        experience={{ ...experience, noResponse: 1, interviewFormats: [], advice: undefined }}
      />,
    )
    expect(quiet).toContain('First response: No response yet')
    expect(quiet).not.toContain('Interview formats')
  })
})

describe('OutcomeBadge', () => {
  it.each([
    ['offer', 'Offer'],
    ['rejected', 'Rejected'],
    ['ghosted', 'Ghosted'],
    ['withdrew', 'Withdrew'],
    ['in_progress', 'In progress'],
    ['hired', 'Other'],
  ])('%s shows the word %s', (outcome, word) => {
    expect(render(<OutcomeBadge outcome={outcome} />)).toContain(`>${word}<`)
  })
})

describe('VerifiedBadge', () => {
  it('shows for stored 1 or true, hides otherwise', () => {
    expect(render(<VerifiedBadge verified={1} />)).toContain('Verified')
    expect(render(<VerifiedBadge verified={true} />)).toContain('Verified')
    expect(render(<VerifiedBadge verified={0} />)).toBe('')
    expect(render(<VerifiedBadge verified={undefined} />)).toBe('')
  })

  it('explains itself to screen readers', () => {
    expect(render(<VerifiedBadge verified={1} />)).toContain(
      'aria-label="Verified. An admin confirmed this is a real company."',
    )
  })
})

describe('EmptyState', () => {
  it('renders link and button actions', () => {
    const html = render(
      <EmptyState
        title="Nothing here"
        action={{ label: 'Share yours', to: '/experiences/new' }}
        secondaryAction={{ label: 'Clear filters', onClick: () => {} }}
      />,
    )
    expect(html).toContain('Nothing here')
    expect(html).toMatch(/<a[^>]*href="\/experiences\/new"[^>]*>Share yours<\/a>/)
    expect(html).toMatch(/<button[^>]*>Clear filters<\/button>/)
  })
})
