/**
 * One color per outcome, always with the word (never color alone):
 * offer = green, rejected = red, ghosted = gray, withdrew = neutral,
 * in progress = blue. Tinted (colored text on a faint fill) so the word stays
 * readable on the dark theme.
 */

import { cn } from '@/lib/utils'
import { OUTCOMES, isOneOf, labelFor, type Outcome } from '@/lib/options'

const STYLES: Record<Outcome, string> = {
  offer: 'border-success/40 bg-success/15 text-success',
  rejected: 'border-destructive/40 bg-destructive/15 text-destructive',
  ghosted: 'border-border bg-muted text-muted-foreground',
  withdrew: 'border-border bg-transparent text-foreground',
  in_progress: 'border-info/40 bg-info/15 text-info',
}

export function OutcomeBadge({ outcome, className }: { outcome: string; className?: string }) {
  const style = isOneOf(OUTCOMES, outcome) ? STYLES[outcome] : STYLES.withdrew
  return (
    <span
      data-outcome={outcome}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        style,
        className,
      )}
    >
      {labelFor(OUTCOMES, outcome)}
    </span>
  )
}
