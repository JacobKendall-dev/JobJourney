/**
 * "Verified" with a check icon and a tooltip, shown only for verified
 * companies. Pass the stored value as-is: booleans read back as 0 / 1.
 *
 * The trigger is a real button so keyboard users can reach the tooltip, and
 * its label carries the explanation for screen readers. Inside a card, it sits
 * above the card's stretched link (relative z-10), so it isn't nested in it.
 */

import { BadgeCheck } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui'
import { isTrue } from '@/lib/options'
import { cn } from '@/lib/utils'

const EXPLANATION = 'An admin confirmed this is a real company.'

export function VerifiedBadge({ verified, className }: { verified: unknown; className?: string }) {
  if (!isTrue(verified)) return null

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={`Verified. ${EXPLANATION}`}
        className={cn(
          'relative z-10 inline-flex shrink-0 cursor-default items-center gap-1 rounded-full text-xs font-medium text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <BadgeCheck className="size-3.5" aria-hidden />
        Verified
      </TooltipTrigger>
      <TooltipContent>{EXPLANATION}</TooltipContent>
    </Tooltip>
  )
}
