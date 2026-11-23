/**
 * Small "add a position" form for the share form. It saves nothing: the
 * checked details go back to the share form, and createExperience adds the
 * position when the experience is shared. A position already listed for the
 * company (same title and level) is picked instead.
 */

import { useState, type FormEvent } from 'react'
import { Button, Input, Label } from '@/components/ui'
import { useLookups } from '@/hooks/useLookups'
import { CATEGORIES, LABELS, LEVELS } from '@/lib/options'
import {
  POSITION_TITLE_MAX,
  validateNewPosition,
  type NewPositionFields,
  type NewPositionInput,
} from '@/lib/positions'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive'

export function AddPositionForm({
  companyId,
  onAddLater,
  onUseExisting,
  onCancel,
}: {
  /** Null for a company that's being added with this post (it has no positions yet). */
  companyId: string | null
  onAddLater: (position: NewPositionFields) => void
  onUseExisting: (positionId: string) => void
  onCancel?: () => void
}) {
  const { positionsByCompany } = useLookups()
  const [input, setInput] = useState<NewPositionInput>({ title: '', level: '', category: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof NewPositionInput, string>>>({})

  const update = (key: keyof NewPositionInput, value: string) => {
    setInput((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function handleSubmit(event: FormEvent) {
    // This form sits inside the share form; don't let the event submit that too.
    event.preventDefault()
    event.stopPropagation()
    const result = validateNewPosition(input)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    const existing = (companyId ? (positionsByCompany.get(companyId) ?? []) : []).find(
      (p) => p.data.title.toLowerCase() === result.fields.title.toLowerCase() && p.data.level === result.fields.level,
    )
    // Already listed: just use it.
    if (existing) onUseExisting(existing.recordId)
    else onAddLater(result.fields)
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
          handleSubmit(e as unknown as FormEvent)
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
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="button" size="sm" onClick={(e) => handleSubmit(e as unknown as FormEvent)}>
          Use this position
        </Button>
      </div>
    </div>
  )
}
