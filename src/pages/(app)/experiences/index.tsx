/**
 * Browse experiences — /experiences. Public; filters live in the URL.
 *
 * One live subscription to every experience; filtering, counting, sorting and
 * "Load more" run in the browser (src/lib/browse.ts). New posts appear live.
 */

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ExperienceCard, ExperienceCardSkeleton } from '@/components/ExperienceCard'
import { FilterBar } from '@/components/FilterBar'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/ui'
import { useExperienceFilters } from '@/hooks/useExperienceFilters'
import { useExperiences } from '@/hooks/useExperiences'
import { useLookups } from '@/hooks/useLookups'
import { PAGE_SIZE, appliedMonths, experienceCount, filterExperiences } from '@/lib/browse'

export default function BrowseExperiencesPage() {
  const { filters, setFilters, clearFilters, activeCount } = useExperienceFilters()
  const lookups = useLookups()
  const { experiences, status, error } = useExperiences()
  const [searchParams] = useSearchParams()

  const { companyBySlug, companyById, positionById } = lookups
  const results = useMemo(
    () => filterExperiences(experiences, filters, { companyBySlug, companyById, positionById }),
    [experiences, filters, companyBySlug, companyById, positionById],
  )
  const months = useMemo(() => appliedMonths(experiences), [experiences])

  // How many results are shown; resets whenever the filters change.
  const filterKey = searchParams.toString()
  const [shown, setShown] = useState({ key: filterKey, count: PAGE_SIZE })
  const visibleCount = shown.key === filterKey ? shown.count : PAGE_SIZE
  const visible = results.slice(0, visibleCount)

  const loading = status === 'loading' || lookups.status === 'loading'

  return (
    <PageShell
      title="Browse experiences"
      description={filters.q ? `Searching for “${filters.q}”` : 'Real application timelines, shared by job seekers.'}
    >
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        clearFilters={clearFilters}
        activeCount={activeCount}
        lookups={lookups}
        months={months}
      />

      {loading ? (
        <div className="grid gap-3" aria-busy="true" aria-label="Loading experiences">
          <ExperienceCardSkeleton />
          <ExperienceCardSkeleton />
          <ExperienceCardSkeleton />
        </div>
      ) : status === 'error' ? (
        <EmptyState icon={<SearchX aria-hidden />} title="Couldn't load experiences." description={error} />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<SearchX aria-hidden />}
          title={activeCount > 0 ? 'No experiences match these filters yet.' : 'No experiences shared yet.'}
          description="Applied somewhere recently? Your experience helps the next person."
          action={{ label: 'Share yours', to: '/experiences/new' }}
          secondaryAction={activeCount > 0 ? { label: 'Clear filters', onClick: clearFilters } : undefined}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
            {experienceCount(results.length)}
          </p>
          <div className="grid gap-3">
            {visible.map((e) => (
              <ExperienceCard
                key={e.recordId}
                id={e.recordId}
                experience={e.data}
                company={lookups.companyById.get(e.data.companyId)?.data}
                position={lookups.positionById.get(e.data.positionId)?.data}
              />
            ))}
          </div>
          {visible.length < results.length && (
            <div className="mt-6 flex flex-col items-center gap-1">
              <Button
                variant="outline"
                onClick={() => setShown({ key: filterKey, count: visibleCount + PAGE_SIZE })}
              >
                Load more
              </Button>
              <span className="text-xs text-muted-foreground">
                Showing {visible.length} of {results.length}
              </span>
            </div>
          )}
        </>
      )}
    </PageShell>
  )
}
