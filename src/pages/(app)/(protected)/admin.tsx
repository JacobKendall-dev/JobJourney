/**
 * Admin — /admin. Signed in (the (protected) layout) and admin only.
 *
 * This role check only decides what the page shows. Every admin action
 * re-checks the role on the server with resolveAppRole.
 */

import { useState } from 'react'
import { Database } from 'lucide-react'
import { PageShell, Placeholder } from '@/components/PageShell'
import { Button, useToast } from '@/components/ui'
import { useRole } from '@/hooks/useRole'
import { callAction } from '@/lib/actions'

export default function AdminPage() {
  const { ready, isAdmin } = useRole()

  if (!ready) return null

  if (!isAdmin) {
    return <PageShell title="Admins only" description="You don't have access to this page." />
  }

  return (
    <PageShell title="Admin" description="Verify companies and moderate posts.">
      <SampleDataCard />
      <div className="mt-6">
        <Placeholder>Company queue, cleanup and moderation arrive in the “Admin” step.</Placeholder>
      </div>
    </PageShell>
  )
}

function SampleDataCard() {
  const { success, error } = useToast()
  const [loading, setLoading] = useState(false)

  async function loadSampleData() {
    setLoading(true)
    const result = await callAction<{
      companiesCreated: number
      companiesUpdated: number
      positionsCreated: number
      experiencesCreated: number
    }>('seedSampleData')
    setLoading(false)
    if (!result.success) {
      error("Couldn't load sample data", result.error)
      return
    }
    const { companiesCreated, companiesUpdated, positionsCreated, experiencesCreated } = result.data
    if (companiesCreated + companiesUpdated + positionsCreated + experiencesCreated === 0) {
      success('Sample data is already loaded')
    } else {
      const parts = [
        companiesCreated > 0 && `added ${companiesCreated} companies`,
        positionsCreated > 0 && `added ${positionsCreated} positions`,
        experiencesCreated > 0 && `added ${experiencesCreated} experiences`,
        companiesUpdated > 0 && `updated ${companiesUpdated} companies`,
      ].filter(Boolean)
      const summary = parts.join(', ')
      success('Sample data loaded', `${summary.charAt(0).toUpperCase()}${summary.slice(1)}.`)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-base font-semibold text-foreground">Sample data</h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Adds five clearly-labelled sample companies (Example, Sample, Demo, Placeholder) with two or
        three positions each, and ten sample experiences covering every outcome. Safe to run more
        than once: anything already there is skipped.
      </p>
      <Button className="mt-3" onClick={loadSampleData} loading={loading}>
        <Database aria-hidden />
        Load sample data
      </Button>
    </section>
  )
}
