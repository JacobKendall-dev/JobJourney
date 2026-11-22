/** Company profile — /companies/:slug. Public; admin buttons for admins. */

import { Link, useParams } from 'react-router-dom'
import { PageShell, Placeholder } from '@/components/PageShell'
import { useLookups } from '@/hooks/useLookups'
import { INDUSTRIES, isTrue, labelFor } from '@/lib/options'

export default function CompanyProfilePage() {
  const { slug = '' } = useParams()
  const { status, companyBySlug, positionsByCompany } = useLookups()
  const company = companyBySlug.get(slug)

  if (status === 'loading') return <PageShell title="Loading…" />

  if (!company) {
    return (
      <PageShell title="Company not found" description="We don't have a company at this address.">
        <Link to="/companies" className="text-sm underline underline-offset-4">
          See all companies
        </Link>
      </PageShell>
    )
  }

  const positions = positionsByCompany.get(company.recordId) ?? []

  return (
    <PageShell
      title={company.data.name}
      description={`${labelFor(INDUSTRIES, company.data.industry)} · ${
        isTrue(company.data.verified) ? 'Verified' : 'Unverified · added by the community'
      }`}
      actions={
        <Link
          to={`/experiences/new?company=${encodeURIComponent(slug)}`}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Share an experience here
        </Link>
      }
    >
      <Placeholder>
        <p>At-a-glance stats, positions and experiences arrive in the “Companies” step.</p>
        {/* Temporary readout for testing the slug lookup. */}
        <p className="mt-3">{positions.length} positions</p>
      </Placeholder>
    </PageShell>
  )
}
