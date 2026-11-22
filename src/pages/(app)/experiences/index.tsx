/** Browse experiences — /experiences. Public; filters live in the URL. */

import { PageShell, Placeholder } from '@/components/PageShell'
import { useExperienceFilters } from '@/hooks/useExperienceFilters'

export default function BrowseExperiencesPage() {
  const { filters, setFilters, clearFilters, activeCount } = useExperienceFilters()

  return (
    <PageShell
      title="Browse experiences"
      description={
        filters.q ? `Searching for “${filters.q}”` : 'Real application timelines, shared by job seekers.'
      }
    >
      <Placeholder>
        <p>Filter bar and experience cards arrive in the “Browse with filters” step.</p>
        {/* Temporary readout for testing useExperienceFilters; replaced by FilterBar. */}
        <pre className="mt-3 overflow-x-auto text-xs">{JSON.stringify(filters, null, 2)}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs"
            onClick={() => setFilters({ outcome: 'offer' })}
          >
            Outcome: offer
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs"
            onClick={() => setFilters({ sort: filters.sort === 'newest' ? 'helpful' : 'newest' })}
          >
            Toggle sort
          </button>
          {activeCount > 0 && (
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs"
              onClick={clearFilters}
            >
              Clear filters ({activeCount})
            </button>
          )}
        </div>
      </Placeholder>
    </PageShell>
  )
}
