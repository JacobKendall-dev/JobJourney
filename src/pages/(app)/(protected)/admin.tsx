/**
 * Admin — /admin. Signed in (the (protected) layout) and admin only.
 *
 * This role check only decides what the page shows. Every admin action
 * re-checks the role on the server with resolveAppRole.
 */

import { useAuthProfileReady } from 'deepspace'
import { PageShell, Placeholder } from '@/components/PageShell'

export default function AdminPage() {
  const { user, userLoading } = useAuthProfileReady({ requireUser: true })

  if (userLoading || !user) return null

  if (user.role !== 'admin') {
    return (
      <PageShell title="Admins only" description="You don't have access to this page." />
    )
  }

  return (
    <PageShell title="Admin" description="Verify companies and moderate posts.">
      <Placeholder>Company queue, cleanup and moderation arrive in the “Admin” step.</Placeholder>
    </PageShell>
  )
}
