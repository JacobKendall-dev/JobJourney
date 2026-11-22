/**
 * Helpful (N). Toggles the caller's vote through the `toggleHelpful` action,
 * which recounts `helpfulCount`; the count on screen comes from the live
 * experience record, so other people's votes appear without a refresh.
 *
 * Filled when you've voted (your own `helpfulVotes` row). Not shown as a
 * button on your own post. Signed out → "Sign in" prompt.
 */

import { useState } from 'react'
import { useQuery } from 'deepspace'
import { ThumbsUp } from 'lucide-react'
import { Button, useToast } from '@/components/ui'
import { SignInButton } from '@/components/SignInButton'
import { callAction } from '@/lib/actions'
import { cn } from '@/lib/utils'
import type { HelpfulVote } from '@/schemas/helpful-votes-schema'

interface HelpfulButtonProps {
  experienceId: string
  count: number
  userId: string | null
  isAuthor: boolean
}

export function HelpfulButton({ experienceId, count, userId, isAuthor }: HelpfulButtonProps) {
  const label = `Helpful (${count})`
  if (!userId) {
    return (
      <SignInButton aria-label={`${label}. Sign in to mark this helpful.`}>
        <ThumbsUp aria-hidden />
        {label}
      </SignInButton>
    )
  }
  if (isAuthor) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 text-sm text-muted-foreground">
        <ThumbsUp className="size-4" aria-hidden />
        {count} found this helpful
      </span>
    )
  }
  return <VoteButton experienceId={experienceId} label={label} userId={userId} />
}

function VoteButton({ experienceId, label, userId }: { experienceId: string; label: string; userId: string }) {
  const toast = useToast()
  // Admins can read every vote, so filter to this user's own.
  const { records, status } = useQuery<HelpfulVote>('helpfulVotes', { where: { experienceId, userId } })
  const [pending, setPending] = useState(false)
  const voted = records.length > 0

  async function toggle() {
    setPending(true)
    const result = await callAction<{ voted: boolean }>('toggleHelpful', { experienceId })
    setPending(false)
    if (!result.success) toast.error(result.error)
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={voted ? 'default' : 'outline'}
      aria-pressed={voted}
      disabled={pending || status === 'loading'}
      onClick={toggle}
    >
      <ThumbsUp className={cn(voted && 'fill-current')} aria-hidden />
      {label}
    </Button>
  )
}
