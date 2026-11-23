/**
 * The experience summary used on Browse, company pages, Bookmarks, My posts
 * and the share-form preview.
 *
 * - With `id`, the whole card links to /experiences/:id. The link is the
 *   title, stretched over the card with ::after, so the Verified tooltip can
 *   sit above it as its own button (interactive elements can't nest in links).
 * - Without `id` (the share preview), nothing links.
 * - All user text renders as plain text: React escapes it, and nothing here
 *   uses dangerouslySetInnerHTML.
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, ThumbsUp } from 'lucide-react'
import { OutcomeBadge } from './OutcomeBadge'
import { VerifiedBadge } from './VerifiedBadge'
import { INTERVIEW_FORMATS, LABELS, WORK_ARRANGEMENTS, isOneOf, labelFor } from '@/lib/options'
import {
  excerptSource,
  firstResponseText,
  formatMonth,
  stagesText,
  type Experience,
} from '@/lib/experience'
import type { Company } from '@/schemas/companies-schema'
import type { Position } from '@/schemas/positions-schema'
import { cn } from '@/lib/utils'

export interface ExperienceCardProps {
  experience: Experience
  /** The experience's record id. Omit for a non-linking preview. */
  id?: string
  company?: Pick<Company, 'name' | 'verified'>
  position?: Pick<Position, 'title'>
  className?: string
  /**
   * Controls shown at the bottom of the card (Edit, Delete, Remove). They sit
   * above the card's full-size link, so they stay clickable.
   */
  actions?: ReactNode
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

export function ExperienceCard({ experience, id, company, position, className, actions }: ExperienceCardProps) {
  const title = position?.title || 'Unknown position'
  const facts = [
    isOneOf(WORK_ARRANGEMENTS, experience.workArrangement) && LABELS[experience.workArrangement],
    formatMonth(experience.appliedMonth) && `Applied ${formatMonth(experience.appliedMonth)}`,
    firstResponseText(experience) && `First response: ${firstResponseText(experience)}`,
    stagesText(experience.interviewStages),
  ].filter(Boolean)
  const formats = Array.isArray(experience.interviewFormats) ? experience.interviewFormats : []
  const excerpt = excerptSource(experience)
  const helpful = Math.max(0, experience.helpfulCount ?? 0)
  const comments = Math.max(0, experience.commentCount ?? 0)

  return (
    <article
      data-testid="experience-card"
      className={cn(
        'relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors',
        id && 'focus-within:ring-2 focus-within:ring-ring hover:border-muted-foreground/50',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-foreground">
            {id ? (
              <Link
                to={`/experiences/${encodeURIComponent(id)}`}
                className="outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
              >
                {title}
              </Link>
            ) : (
              title
            )}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="truncate">{company?.name || 'Unknown company'}</span>
            {company && <VerifiedBadge verified={company.verified} />}
          </div>
        </div>
        <OutcomeBadge outcome={experience.outcome} />
      </div>

      {facts.length > 0 && (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {facts.map((fact) => (
            <span key={fact as string}>{fact}</span>
          ))}
        </p>
      )}

      {formats.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Interview formats">
          {formats.map((format) => (
            <li
              key={format}
              className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
            >
              {labelFor(INTERVIEW_FORMATS, format)}
            </li>
          ))}
        </ul>
      )}

      {excerpt && <p className="line-clamp-2 break-words text-sm text-foreground/90">{excerpt}</p>}

      <p className="flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ThumbsUp className="size-3.5" aria-hidden />
          {plural(helpful, 'helpful vote')}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-3.5" aria-hidden />
          {plural(comments, 'comment')}
        </span>
      </p>

      {actions && <div className="relative z-10 flex flex-wrap gap-2 border-t border-border pt-3">{actions}</div>}
    </article>
  )
}

/** Gray placeholder in the card's shape, shown while experiences load. */
export function ExperienceCardSkeleton() {
  return (
    <div
      aria-hidden
      data-testid="experience-card-skeleton"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-3 w-64 animate-pulse rounded bg-muted" />
      <div className="flex gap-1.5">
        <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
        <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-3 w-full animate-pulse rounded bg-muted" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
    </div>
  )
}
