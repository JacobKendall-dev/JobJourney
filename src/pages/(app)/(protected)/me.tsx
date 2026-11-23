/**
 * My posts — /me. Signed in only.
 *
 * Your experiences come from your own private `experienceAuthors` rows,
 * matched to the public experiences. Nobody else can read those rows, admins
 * included, which is what "Only you can see this list" promises.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PenLine, Pencil, ShieldCheck } from 'lucide-react'
import { DeleteExperienceButton } from '@/components/DeleteExperienceButton'
import { EmptyState } from '@/components/EmptyState'
import { ExperienceCard, ExperienceCardSkeleton } from '@/components/ExperienceCard'
import { PageShell } from '@/components/PageShell'
import { buttonVariants } from '@/components/ui'
import { useExperiences } from '@/hooks/useExperiences'
import { useLookups } from '@/hooks/useLookups'
import { useMyAuthorship } from '@/hooks/useMyAuthorship'
import { useRole } from '@/hooks/useRole'
import { experienceCount } from '@/lib/browse'
import { sortExperiences } from '@/lib/stats'

export default function MyPostsPage() {
  const { userId } = useRole()
  const authorship = useMyAuthorship(userId)
  const { experiences, status, error } = useExperiences()
  const { companyById, positionById } = useLookups()

  const mine = useMemo(
    () => sortExperiences(experiences.filter((e) => authorship.experienceIds.has(e.recordId)), 'newest'),
    [experiences, authorship.experienceIds],
  )
  const loading = !userId || status === 'loading' || authorship.status === 'loading'

  return (
    <PageShell
      title="My posts"
      description={
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-4" aria-hidden />
          Only you can see this list.
        </span>
      }
      actions={
        <Link to="/experiences/new" className={buttonVariants({ size: 'sm' })}>
          <PenLine aria-hidden />
          Share another
        </Link>
      }
    >
      {loading ? (
        <div className="grid gap-3" aria-busy="true" aria-label="Loading your posts">
          <ExperienceCardSkeleton />
          <ExperienceCardSkeleton />
        </div>
      ) : status === 'error' || authorship.status === 'error' ? (
        <EmptyState title="Couldn't load your posts." description={error ?? authorship.error ?? undefined} />
      ) : mine.length === 0 ? (
        <EmptyState
          icon={<PenLine aria-hidden />}
          title="You haven't shared anything yet."
          description="Your experience helps the next person applying."
          action={{ label: 'Share your experience', to: '/experiences/new' }}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{experienceCount(mine.length)}</p>
          <div className="grid gap-3">
            {mine.map((e) => (
              <ExperienceCard
                key={e.recordId}
                id={e.recordId}
                experience={e.data}
                company={companyById.get(e.data.companyId)?.data}
                position={positionById.get(e.data.positionId)?.data}
                actions={
                  <>
                    <Link
                      to={`/experiences/${encodeURIComponent(e.recordId)}/edit`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      <Pencil aria-hidden />
                      Edit
                    </Link>
                    <DeleteExperienceButton experienceId={e.recordId} />
                  </>
                }
              />
            ))}
          </div>
        </>
      )}
    </PageShell>
  )
}
