/**
 * Experience detail — /experiences/:id. Public; interacting needs sign-in.
 *
 * This is `[id]/index.tsx`, not `[id].tsx`: a `[id].tsx` beside the `[id]/`
 * folder would become the parent route of `[id]/edit`, and the edit URL would
 * render this page instead.
 *
 * Helpful goes through `toggleHelpful`, comments through `postComment`;
 * bookmarks and comment edits are direct writes. The author's Edit / Delete
 * arrive with the "Edit, My posts, Bookmarks" step.
 */

import { Link, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { FileQuestion } from 'lucide-react'
import { BookmarkButton } from '@/components/BookmarkButton'
import { CommentThread } from '@/components/CommentThread'
import { EmptyState } from '@/components/EmptyState'
import { HelpfulButton } from '@/components/HelpfulButton'
import { ExperienceCardSkeleton } from '@/components/ExperienceCard'
import { OutcomeBadge } from '@/components/OutcomeBadge'
import { PageShell } from '@/components/PageShell'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { useExperiences } from '@/hooks/useExperiences'
import { useRole } from '@/hooks/useRole'
import { useLookups } from '@/hooks/useLookups'
import { bylineText, firstResponseText, formatMonth, stagesText } from '@/lib/experience'
import { INTERVIEW_FORMATS, LABELS, LEVELS, WORK_ARRANGEMENTS, isOneOf, labelFor } from '@/lib/options'
import type { ExperienceAuthor } from '@/schemas/experience-authors-schema'

export default function ExperienceDetailPage() {
  const { id = '' } = useParams()
  const { experiences, status } = useExperiences()
  const { companyById, positionById } = useLookups()
  const auth = useRole()
  const userId = auth.userId
  // Your own author row, if you wrote this. Only its author can read it, and
  // signed-out visitors get nothing back.
  const { records: authorRows } = useQuery<ExperienceAuthor>('experienceAuthors', { where: { experienceId: id } })
  const isAuthor = !!userId && authorRows.some((r) => r.createdBy === userId)

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

      <div className="flex flex-wrap items-center gap-2" aria-label="Actions" role="group">
        {auth.ready ? (
          <>
            <HelpfulButton experienceId={id} count={e.helpfulCount ?? 0} userId={userId} isAuthor={isAuthor} />
            <BookmarkButton experienceId={id} userId={userId} />
            {isAuthor && <span className="text-xs text-muted-foreground">This is your post.</span>}
          </>
        ) : (
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" aria-hidden />
        )}
      </div>

      <CommentThread
        experienceId={id}
        userId={auth.ready ? userId : null}
        isAuthor={isAuthor}
      />
    </PageShell>
  )
}
