/**
 * Picks one of a company's positions, or describes a new one. A new position
 * isn't saved here: createExperience adds it when the experience is shared.
 */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AddPositionForm } from '@/components/AddPositionForm'
import { Button } from '@/components/ui'
import { useLookups } from '@/hooks/useLookups'
import { LEVELS, labelFor } from '@/lib/options'
import type { NewPositionFields } from '@/lib/positions'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:opacity-50'

/** The select's value for the new position. Not a valid record id. */
const NEW = '__new__'

export function PositionPicker({
  companyId,
  companyIsNew,
  value,
  pending,
  onChange,
  onPending,
  error,
}: {
  companyId: string | null
  /** The company is being added with this post, so it has no positions yet. */
  companyIsNew: boolean
  value: string | null
  pending: NewPositionFields | null
  onChange: (positionId: string | null) => void
  onPending: (position: NewPositionFields) => void
  error?: string
}) {
  const { positionsByCompany } = useLookups()
  const [adding, setAdding] = useState(false)

  const hasCompany = !!companyId || companyIsNew
  const positions = companyId ? (positionsByCompany.get(companyId) ?? []) : []
  // A new company has nothing to pick from, so go straight to the form.
  const showForm = hasCompany && (adding || (companyIsNew && !pending))

  return (
    <div className="flex flex-col gap-2">
      <select
        id="share-position"
        value={pending ? NEW : (value ?? '')}
        disabled={!hasCompany}
        aria-invalid={!!error}
        aria-describedby={error ? 'share-position-error' : undefined}
        onChange={(e) => {
          if (e.target.value !== NEW) onChange(e.target.value || null)
        }}
        className={selectClass}
      >
        <option value="">
          {!hasCompany ? 'Choose the company first' : positions.length ? 'Choose a position' : 'No positions yet: add one'}
        </option>
        {positions.map((p) => (
          <option key={p.recordId} value={p.recordId}>
            {p.data.title} · {labelFor(LEVELS, p.data.level)}
          </option>
        ))}
        {pending && (
          <option value={NEW}>
            {pending.title} · {labelFor(LEVELS, pending.level)} (new)
          </option>
        )}
      </select>
      {pending && !showForm && (
        <p className="text-xs text-muted-foreground">New position: it's added when you share your experience.</p>
      )}

      {showForm ? (
        <AddPositionForm
          companyId={companyId}
          onCancel={companyIsNew && !pending ? undefined : () => setAdding(false)}
          onAddLater={(position) => {
            setAdding(false)
            onPending(position)
          }}
          onUseExisting={(positionId) => {
            setAdding(false)
            onChange(positionId)
          }}
        />
      ) : (
        hasCompany && (
          <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            {pending ? 'Change the new position' : 'Add a position'}
          </Button>
        )
      )}
    </div>
  )
}
