/** Browse experiences — /experiences. Public; filters live in the URL. */

import { useSearchParams } from 'react-router-dom'
import { PageShell, Placeholder } from '@/components/PageShell'

export default function BrowseExperiencesPage() {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q')

  return (
    <PageShell
      title="Browse experiences"
      description={q ? `Searching for “${q}”` : 'Real application timelines, shared by job seekers.'}
    >
      <Placeholder>Filter bar and experience cards arrive in the “Browse with filters” step.</Placeholder>
    </PageShell>
  )
}
