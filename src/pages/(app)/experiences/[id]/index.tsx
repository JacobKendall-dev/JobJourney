/**
 * Experience detail — /experiences/:id. Public; interacting needs sign-in.
 *
 * This is `[id]/index.tsx`, not `[id].tsx`: a `[id].tsx` beside the `[id]/`
 * folder would become the parent route of `[id]/edit`, and the edit URL would
 * render this page instead.
 *
 * Read-only for now. Helpful, bookmark, comments and the author's
 * Edit / Delete arrive in the "Experience detail" step.
 */

import { Link, useParams } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ExperienceCardSkeleton } from '@/components/ExperienceCard'
import { OutcomeBadge } from '@/components/OutcomeBadge'
import { PageShell } from '@/components/PageShell'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { useExperiences } from '@/hooks/useExperiences'
import { useLookups } from '@/hooks/useLookups'
import { bylineText, firstResponseText, formatMonth, stagesText } from '@/lib/experience'
import { INTERVIEW_FORMATS, LABELS, LEVELS, WORK_ARRANGEMENTS, isOneOf, labelFor } from '@/lib/options'

export default function ExperienceDetailPage() {
  const { id = '' } = useParams()
  const { experiences, status } = useExperiences()
  const { companyById, positionById } = useLookups()

  if (status === 'loading') {
    return (
      <PageShell title={<span className="inline-block h-7 w-64 animate-pulse rounded bg-muted" />}>
        <ExperienceCardSkeleton />
      </PageShell>
    )
  }

  const experience = experiences.find((e) => e.recordId === id)
  if (!experience) {
    return (
      <PageShell title="Experience not found">
        <EmptyState
          icon={<FileQuestion aria-hidden />}
          title="This experience doesn't exist or was deleted."
          action={{ label: 'Browse experiences', to: '/experiences' }}
        />
      </PageShell>
    )
  }

  const e = experience.data
  const company = companyById.get(e.companyId)
  const position = positionById.get(e.positionId)
  const facts: [string, string | undefined][] = [
    ['Applied', formatMonth(e.appliedMonth)],
    ['Work arrangement', isOneOf(WORK_ARRANGEMENTS, e.workArrangement) ? LABELS[e.workArrangement] : undefined],
    ['First response', firstResponseText(e)],
    ['Interview stages', stagesText(e.interviewStages)],
  ]
  const formats = Array.isArray(e.interviewFormats) ? e.interviewFormats : []

  return (
    <PageShell
      title={
        <span className="flex flex-wrap items-center gap-3">
          {position?.data.title ?? 'Unknown position'}
          <OutcomeBadge outcome={e.outcome} />
        </span>
      }
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {company ? (
            <Link to={`/companies/${company.data.slug}`} className="underline-offset-4 hover:text-foreground hover:underline">
              {company.data.name}
            </Link>
          ) : (
            'Unknown company'
          )}
          {company && <VerifiedBadge verified={company.data.verified} />}
          {position && (
            <>
              <span aria-hidden>·</span>
              <span>{labelFor(LEVELS, position.data.level)}</span>
            </>
          )}
        </span>
      }
    >
      <p className="mb-6 text-sm text-muted-foreground">{bylineText(e)}</p>

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">{value || '—'}</dd>
          </div>
        ))}
      </dl>

      {formats.length > 0 && (
        <ul className="mb-6 flex flex-wrap gap-1.5" aria-label="Interview formats">
          {formats.map((format) => (
            <li key={format} className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              {labelFor(INTERVIEW_FORMATS, format)}
            </li>
          ))}
        </ul>
      )}

      {/* Plain text only: React escapes it; whitespace-pre-line keeps the author's line breaks. */}
      {e.interviewExperience && (
        <section className="mb-6">
          <h2 className="mb-2 text-base font-semibold text-foreground">Interview experience</h2>
          <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground/90">{e.interviewExperience}</p>
        </section>
      )}
      {e.advice && (
        <section className="mb-6">
          <h2 className="mb-2 text-base font-semibold text-foreground">Advice for others</h2>
          <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground/90">{e.advice}</p>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        {e.helpfulCount ?? 0} helpful · {e.commentCount ?? 0} comments · Helpful votes and comments arrive in the
        “Experience detail” step.
      </p>
    </PageShell>
  )
}
