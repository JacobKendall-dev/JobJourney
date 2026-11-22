/** Share an experience — /experiences/new. Signed in only (the (protected) layout). */

import { useSearchParams } from 'react-router-dom'
import { PageShell, Placeholder } from '@/components/PageShell'

export default function ShareExperiencePage() {
  const [searchParams] = useSearchParams()
  const company = searchParams.get('company')

  return (
    <PageShell
      title="Share your experience"
      description={company ? `Pre-selected company: ${company}` : 'Anonymous by default.'}
    >
      <Placeholder>The share form arrives in the “Share form + createExperience” step.</Placeholder>
    </PageShell>
  )
}
