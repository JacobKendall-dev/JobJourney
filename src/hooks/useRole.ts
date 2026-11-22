/**
 * The signed-in user's role, for deciding what to SHOW. It never decides what
 * is allowed: actions re-check the role on the server with resolveAppRole, and
 * record writes are checked by the schema's permissions.
 */

import { useAuthProfileReady } from 'deepspace'

export function useRole() {
  const { isLoaded, isSignedIn, user, userLoading } = useAuthProfileReady({ requireUser: true })
  const ready = isLoaded && (!isSignedIn || (!userLoading && !!user))
  const role = isSignedIn ? (user?.role ?? 'member') : 'viewer'
  return { ready, isSignedIn: !!isSignedIn, isAdmin: ready && role === 'admin', role, user }
}
