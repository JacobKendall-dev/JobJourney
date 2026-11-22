/** Picks one of a company's positions, or adds a new one inline. */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AddPositionForm, type CreatedPosition } from '@/components/AddPositionForm'
import { Button } from '@/components/ui'
import { useLookups } from '@/hooks/useLookups'
import { LABELS, LEVELS, labelFor } from '@/lib/options'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:opacity-50'

export function PositionPicker({
  companyId,
  value,
  onChange,
  error,
}: {
  companyId: string | null
  value: string | null
  onChange: (positionId: string | null) => void
  error?: string
}) {
  const { positionsByCompany } = useLookups()
  const [adding, setAdding] = useState(false)
  const [justCreated, setJustCreated] = useState<CreatedPosition | null>(null)

  const positions = companyId ? (positionsByCompany.get(companyId) ?? []) : []
  // Keep a just-created position selectable until the live list includes it.
  const showJustCreated = justCreated && !positions.some((p) => p.recordId === justCreated.recordId)

  return (
    <div className="flex flex-col gap-2">
      <select
        id="share-position"
        value={value ?? ''}
        disabled={!companyId}
        aria-invalid={!!error}
        aria-describedby={error ? 'share-position-error' : undefined}
        onChange={(e) => onChange(e.target.value || null)}
        className={selectClass}
      >
        <option value="">
          {!companyId ? 'Choose the company first' : positions.length ? 'Choose a position' : 'No positions yet: add one'}
        </option>
        {positions.map((p) => (
          <option key={p.recordId} value={p.recordId}>
            {p.data.title} · {labelFor(LEVELS, p.data.level)}
          </option>
        ))}
        {showJustCreated && (
          <option value={justCreated.recordId}>
            {justCreated.title} · {LABELS[justCreated.level] ?? 'Other'}
          </option>
        )}
      </select>

      {companyId &&
        (adding ? (
          <AddPositionForm
            companyId={companyId}
            onCancel={() => setAdding(false)}
            onCreated={(position) => {
              setJustCreated(position)
              setAdding(false)
              onChange(position.recordId)
            }}
          />
        ) : (
          <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            Add a position
          </Button>
        ))}
    </div>
  )
}
