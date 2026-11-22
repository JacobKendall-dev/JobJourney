/** Share an experience — /experiences/new. Signed in only (the (protected) layout). */

import { useSearchParams } from 'react-router-dom'
import { ExperienceCard, ExperienceCardSkeleton } from '@/components/ExperienceCard'
import { OutcomeBadge } from '@/components/OutcomeBadge'
import { PageShell, Placeholder } from '@/components/PageShell'
import type { Experience } from '@/lib/experience'
import { OUTCOMES } from '@/lib/options'

/**
 * Temporary sample data for checking the card while the form doesn't exist.
 * The "Share form" step replaces it with a live preview of what's typed.
 */
const SAMPLE: Experience = {
  companyId: 'sample',
  positionId: 'sample',
  isAnonymous: 1,
  appliedMonth: '2026-09',
  firstResponseDays: 8,
  noResponse: 0,
  interviewStages: 3,
  interviewFormats: ['phone_screen', 'technical', 'final_round'],
  outcome: 'offer',
  interviewExperience: 'A recruiter call, then a 60-minute technical round on arrays and SQL.',
  advice:
    'Practice explaining your projects out loud. They cared more about how you think than the final answer. <b>This tag should show as text.</b> Keep answers short and ask questions at the end of every round.',
  helpfulCount: 12,
  commentCount: 1,
}

export default function ShareExperiencePage() {
  const [searchParams] = useSearchParams()
  const company = searchParams.get('company')

  return (
    <PageShell
      title="Share your experience"
      description={company ? `Pre-selected company: ${company}` : 'Anonymous by default.'}
    >
      <Placeholder>The share form arrives in the “Share form + createExperience” step.</Placeholder>

      {/* Temporary previews for checking step 3's components. */}
      <section className="mt-8 flex flex-col gap-4" aria-label="Component previews">
        <h2 className="text-sm font-semibold text-muted-foreground">Preview (sample data)</h2>
        <ExperienceCard
          experience={SAMPLE}
          company={{ name: 'Example Technologies', verified: 1 }}
          position={{ title: 'Software Engineer Intern' }}
        />
        <ExperienceCard
          experience={{
            ...SAMPLE,
            outcome: 'ghosted',
            noResponse: 1,
            firstResponseDays: undefined,
            interviewStages: 0,
            interviewFormats: [],
            advice: undefined,
            helpfulCount: 1,
            commentCount: 0,
          }}
          company={{ name: 'Sample Unverified Co', verified: 0 }}
          position={{ title: 'Data Analyst' }}
        />
        <ExperienceCardSkeleton />
        <div className="flex flex-wrap gap-2">
          {OUTCOMES.map((outcome) => (
            <OutcomeBadge key={outcome} outcome={outcome} />
          ))}
        </div>
      </section>
    </PageShell>
  )
}
