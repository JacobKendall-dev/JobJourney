/**
 * Small "add a position" form for one company. Uses `createConfirmed`, so a
 * duplicate (same title and level at this company) is caught before the share
 * form tries to use the new position.
 */

import { useState, type FormEvent } from 'react'
import { useMutations } from 'deepspace'
import { Button, Input, Label } from '@/components/ui'
import { useLookups } from '@/hooks/useLookups'
import { isDuplicateError } from '@/lib/companies'
import { CATEGORIES, LABELS, LEVELS } from '@/lib/options'
import { POSITION_TITLE_MAX, validateNewPosition, type NewPositionInput } from '@/lib/positions'
import type { Position } from '@/schemas/positions-schema'

export interface CreatedPosition {
  recordId: string
  title: string
  level: string
}

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive'

export function AddPositionForm({
  companyId,
  onCreated,
  onCancel,
}: {
  companyId: string
  onCreated: (position: CreatedPosition) => void
  onCancel: () => void
}) {
  const { ready, createConfirmed } = useMutations<Position>('positions')
  const { positionsByCompany } = useLookups()
  const [input, setInput] = useState<NewPositionInput>({ title: '', level: '', category: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof NewPositionInput, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const update = (key: keyof NewPositionInput, value: string) => {
    setInput((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setFormError(null)
  }

  async function handleSubmit(event: FormEvent) {
    // This form sits inside the share form; don't let the event submit that too.
    event.preventDefault()
    event.stopPropagation()
    const result = validateNewPosition(input)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    const existing = (positionsByCompany.get(companyId) ?? []).find(
      (p) => p.data.title.toLowerCase() === result.fields.title.toLowerCase() && p.data.level === result.fields.level,
    )
    if (existing) {
      // Already listed: just use it.
      onCreated({ recordId: existing.recordId, title: existing.data.title, level: existing.data.level })
      return
    }

    setSaving(true)
    try {
      const recordId = await createConfirmed({ companyId, ...result.fields })
      onCreated({ recordId, title: result.fields.title, level: result.fields.level })
    } catch (error) {
      setFormError(
        isDuplicateError(error)
          ? 'That position is already listed for this company. Pick it from the list.'
          : error instanceof Error
            ? error.message
            : "Couldn't add the position. Try again.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    // A nested <form> isn't valid HTML, so this is a group submitted by its button.
    <div
      role="group"
      aria-label="Add a position"
      className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
          e.preventDefault()
          void handleSubmit(e as unknown as FormEvent)
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="position-title">Job title</Label>
        <Input
          id="position-title"
          value={input.title}
          maxLength={POSITION_TITLE_MAX}
          placeholder="e.g. Software Engineer Intern"
          aria-invalid={!!errors.title}
          onChange={(e) => update('title', e.target.value)}
          autoFocus
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="position-level">Level</Label>
          <select
            id="position-level"
            value={input.level}
            aria-invalid={!!errors.level}
            onChange={(e) => update('level', e.target.value)}
            className={selectClass}
          >
            <option value="" disabled>
              Choose a level
            </option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {LABELS[level]}
              </option>
            ))}
          </select>
          {errors.level && <p className="text-xs text-destructive">{errors.level}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="position-category">Category</Label>
          <select
            id="position-category"
            value={input.category}
            aria-invalid={!!errors.category}
            onChange={(e) => update('category', e.target.value)}
            className={selectClass}
          >
            <option value="" disabled>
              Choose a category
            </option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {LABELS[category]}
              </option>
            ))}
          </select>
          {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
        </div>
      </div>
      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          loading={saving}
          disabled={!ready}
          onClick={(e) => void handleSubmit(e as unknown as FormEvent)}
        >
          Add position
        </Button>
      </div>
    </div>
  )
}
