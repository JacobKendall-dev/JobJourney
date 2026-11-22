/** Browse experiences — /experiences. Public; filters live in the URL. */

import { SearchX } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageShell } from '@/components/PageShell'
import { useExperienceFilters } from '@/hooks/useExperienceFilters'

export default function BrowseExperiencesPage() {
  const { filters, clearFilters, activeCount } = useExperienceFilters()

  // Experiences arrive in the "Browse with filters" step; until then the list
  // is always empty, so this shows the page's real empty state.
  return (
    <PageShell
      title="Browse experiences"
      description={
        filters.q ? `Searching for “${filters.q}”` : 'Real application timelines, shared by job seekers.'
      }
    >
      <EmptyState
        icon={<SearchX aria-hidden />}
        title={activeCount > 0 ? 'No experiences match these filters yet.' : 'No experiences shared yet.'}
        description="Applied somewhere recently? Your experience helps the next person."
        action={{ label: 'Share yours', to: '/experiences/new' }}
        secondaryAction={activeCount > 0 ? { label: 'Clear filters', onClick: clearFilters } : undefined}
      />
    </PageShell>
  )
}
