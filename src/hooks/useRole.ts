/**
 * The signed-in user and their role, for deciding what to SHOW. It never
 * decides what is allowed: actions re-check on the server with
 * resolveAppRole, and record writes are checked by the schema's permissions.
 *
 * Identity (`userId`) comes from the sign-in session, not the profile: the
 * SDK re-fetches the profile every 30 seconds, and a failed fetch (a network
 * blip, a token mid-refresh) sets it to null for a while. Relying on the
 * profile made "your own" controls vanish until the next good fetch. The last
 * profile loaded for the same user is kept through those gaps.
 */

import { useState } from 'react'
import { useAuthProfileReady, type User } from 'deepspace'

export function useRole() {
  const { isLoaded, isSignedIn, userId: sessionUserId, user: liveUser, userLoading } = useAuthProfileReady({
    requireUser: true,
  })
  const userId = isSignedIn ? sessionUserId : null

  // Remember the last profile loaded (React's "adjust state while rendering").
  const [kept, setKept] = useState<User | null>(null)
  const fresh = liveUser && liveUser.id === userId ? liveUser : null
  if (fresh && fresh !== kept) setKept(fresh)
  const user = fresh ?? (kept && kept.id === userId ? kept : null)

  // Ready once we know who you are; the profile only adds the name and role.
  const ready = isLoaded && (!isSignedIn || (!!userId && (!!user || !userLoading)))
  const role = isSignedIn ? (user?.role ?? 'member') : 'viewer'
  return { ready, isSignedIn: !!isSignedIn, isAdmin: ready && role === 'admin', role, user, userId }
}
