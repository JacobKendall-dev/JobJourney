/**
 * The app's empty and not-found state: an icon, one line, an optional
 * explanation, and the next step as buttons. Wraps the scaffold's
 * ui/EmptyState look, but actions can be links (`to`) as well as handlers,
 * because most next steps navigate ("Share yours", "Browse").
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui'
import { cn } from '@/lib/utils'

export type EmptyStateAction =
  | { label: string; to: string; onClick?: never }
  | { label: string; onClick: () => void; to?: never }

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: ReactNode
  /** Shown as the primary button. */
  action?: EmptyStateAction
  /** Shown as a quieter button beside it. */
  secondaryAction?: EmptyStateAction
  className?: string
}

function ActionButton({ action, primary }: { action: EmptyStateAction; primary: boolean }) {
  const className = buttonVariants({ variant: primary ? 'default' : 'ghost' })
  if (action.to !== undefined) {
    return (
      <Link to={action.to} className={className}>
        {action.label}
      </Link>
    )
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-4 py-14 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground [&_svg]:size-6">
          {icon}
        </div>
      )}
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action && <ActionButton action={action} primary />}
          {secondaryAction && <ActionButton action={secondaryAction} primary={false} />}
        </div>
      )}
    </div>
  )
}
