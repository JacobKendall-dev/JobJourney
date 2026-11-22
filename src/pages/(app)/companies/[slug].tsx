/** Company profile — /companies/:slug. Public; admin buttons for admins. */

import { Link, useParams } from 'react-router-dom'
import { PageShell, Placeholder } from '@/components/PageShell'

export default function CompanyProfilePage() {
  const { slug } = useParams()

  return (
    <PageShell
      title="Company"
      description={`Company slug: ${slug}`}
      actions={
        <Link
          to={`/experiences/new?company=${encodeURIComponent(slug ?? '')}`}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Share an experience here
        </Link>
      }
    >
      <Placeholder>At-a-glance stats, positions and experiences arrive in the “Companies” step.</Placeholder>
    </PageShell>
  )
}
