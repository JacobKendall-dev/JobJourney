/**
 * The centered column every live page renders into (~1100px wide), with the
 * page's heading. Keeps spacing and widths identical across pages.
 */

import type { ReactNode } from 'react'

export function PageShell({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  /** Buttons shown to the right of the title (wrap below it on narrow screens). */
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  )
}

/** Marks a page section that a later build step fills in. Remove as pages are built. */
export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
      {children}
    </div>
  )
}
