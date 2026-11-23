/**
 * My bookmarks — /bookmarks. Signed in only.
 *
 * Your own `bookmarks` rows (newest saved first), matched to the experiences.
 * Admins can read every bookmark, so the query and the match both filter by
 * your id. Remove deletes the bookmark row directly (the schema allows your own).
 */

import { useMemo, useState } from 'react'
import { useMutations, useQuery } from 'deepspace'
import { Bookmark as BookmarkIcon, BookmarkX } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ExperienceCard, ExperienceCardSkeleton } from '@/components/ExperienceCard'
import { PageShell } from '@/components/PageShell'
import { Button, useToast } from '@/components/ui'
import { useExperiences } from '@/hooks/useExperiences'
import { useLookups } from '@/hooks/useLookups'
import { useRole } from '@/hooks/useRole'
import { experienceCount } from '@/lib/browse'
import type { Bookmark } from '@/schemas/bookmarks-schema'

export default function BookmarksPage() {
  const { userId } = useRole()
  const bookmarks = useQuery<Bookmark>('bookmarks', { where: { userId: userId ?? '__signed_out__' } })
  const { experiences, status, error } = useExperiences()
  const { companyById, positionById, status: lookupsStatus } = useLookups()

  const saved = useMemo(() => {
    const byId = new Map(experiences.map((e) => [e.recordId, e]))
    return bookmarks.records
      .filter((b) => b.data.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .flatMap((b) => {
        const experience = byId.get(b.data.experienceId)
        // A deleted experience takes its bookmarks with it; skip any stragglers.
        return experience ? [{ bookmarkId: b.recordId, experience }] : []
      })
  }, [bookmarks.records, experiences, userId])

  const loading = !userId || status === 'loading' || bookmarks.status === 'loading' || lookupsStatus === 'loading'

  return (
    <PageShell title="Bookmarks" description="Experiences you saved.">
      {loading ? (
        <div className="grid gap-3" aria-busy="true" aria-label="Loading your bookmarks">
          <ExperienceCardSkeleton />
          <ExperienceCardSkeleton />
        </div>
      ) : status === 'error' || bookmarks.status === 'error' ? (
        <EmptyState title="Couldn't load your bookmarks." description={error ?? bookmarks.error ?? undefined} />
      ) : saved.length === 0 ? (
        <EmptyState
          icon={<BookmarkIcon aria-hidden />}
          title="Nothing saved yet."
          description="Press Save on any experience to keep it here."
          action={{ label: 'Browse experiences', to: '/experiences' }}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{experienceCount(saved.length)} saved</p>
          <div className="grid gap-3">
            {saved.map(({ bookmarkId, experience: e }) => (
              <ExperienceCard
                key={bookmarkId}
                id={e.recordId}
                experience={e.data}
                company={companyById.get(e.data.companyId)?.data}
                position={positionById.get(e.data.positionId)?.data}
                actions={<RemoveButton bookmarkId={bookmarkId} />}
              />
            ))}
          </div>
        </>
      )}
    </PageShell>
  )
}

function RemoveButton({ bookmarkId }: { bookmarkId: string }) {
  const toast = useToast()
  const { ready, removeConfirmed } = useMutations<Bookmark>('bookmarks')
  const [pending, setPending] = useState(false)

  async function remove() {
    setPending(true)
    try {
      await removeConfirmed(bookmarkId)
    } catch (err) {
      toast.error(`Couldn't remove the bookmark: ${err instanceof Error ? err.message : String(err)}`)
      setPending(false)
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={!ready || pending} onClick={remove}>
      <BookmarkX aria-hidden />
      Remove
    </Button>
  )
}
