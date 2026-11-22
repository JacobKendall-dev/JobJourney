/** Companies — /companies. Public. */

import { Link } from 'react-router-dom'
import { PageShell, Placeholder } from '@/components/PageShell'
import { useLookups } from '@/hooks/useLookups'

export default function CompaniesPage() {
  const { status, error, companies, positions } = useLookups()

  return (
    <PageShell title="Companies" description="Every company with shared experiences.">
      <Placeholder>
        <p>Company search, industry filter and the list arrive in the “Companies” step.</p>
        {/* Temporary readout for testing useLookups; replaced by the company list. */}
        <p className="mt-3">
          {status === 'loading'
            ? 'Loading companies…'
            : status === 'error'
              ? `Couldn't load companies: ${error}`
              : `${companies.length} companies and ${positions.length} positions loaded.`}
        </p>
        <ul className="mt-2 list-disc pl-5">
          {companies.map((c) => (
            <li key={c.recordId}>
              <Link to={`/companies/${c.data.slug}`} className="underline underline-offset-4">
                {c.data.name}
              </Link>
            </li>
          ))}
        </ul>
      </Placeholder>
    </PageShell>
  )
}
