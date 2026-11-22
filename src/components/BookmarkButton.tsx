/**
 * Save / Saved. Creates or deletes the caller's own `bookmarks` row directly
 * (no action: the schema stamps `userId` and refuses a second bookmark).
 * Disabled until the record room accepts writes and while a write is pending.
 */

import { useState } from 'react'
import { useMutations, useQuery } from 'deepspace'
import { Bookmark as BookmarkIcon } from 'lucide-react'
import { Button, useToast } from '@/components/ui'
import { SignInButton } from '@/components/SignInButton'
import { cn } from '@/lib/utils'
import type { Bookmark } from '@/schemas/bookmarks-schema'

export function BookmarkButton({ experienceId, userId }: { experienceId: string; userId: string | null }) {
  if (!userId) {
    return (
      <SignInButton aria-label="Save. Sign in to bookmark this experience.">
        <BookmarkIcon aria-hidden />
        Save
      </SignInButton>
    )
  }
  return <SaveToggle experienceId={experienceId} userId={userId} />
}

function SaveToggle({ experienceId, userId }: { experienceId: string; userId: string }) {
  const toast = useToast()
  // Admins can read every bookmark, so filter to this user's own.
  const { records, status } = useQuery<Bookmark>('bookmarks', { where: { experienceId, userId } })
  const { ready, createConfirmed, removeConfirmed } = useMutations<Bookmark>('bookmarks')
  const [pending, setPending] = useState(false)
  const saved = records.length > 0

  async function toggle() {
    setPending(true)
    try {
      if (saved) {
        for (const r of records) await removeConfirmed(r.recordId)
      } else {
        await createConfirmed({ experienceId, userId })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Already saved (a double click or a second tab): nothing to report.
      if (!/duplicate/i.test(message)) toast.error(`Couldn't update your bookmark: ${message}`)
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-pressed={saved}
      disabled={!ready || pending || status === 'loading'}
      onClick={toggle}
    >
      <BookmarkIcon className={cn(saved && 'fill-current')} aria-hidden />
      {saved ? 'Saved' : 'Save'}
    </Button>
  )
}
