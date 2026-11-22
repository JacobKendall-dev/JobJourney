/**
 * The small "add a company" form, used on /companies now and inside the
 * share form's company picker later.
 *
 * It uses `createConfirmed`, which resolves only once the server accepts the
 * write, so a taken name shows here instead of as a late toast — and the next
 * step (opening the company, or picking it in the share form) never points at
 * a company the server refused. The server still enforces everything: only
 * these fields, a unique slug, and `verified` starting false.
 */

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutations } from 'deepspace'
import { Button, Input, Label } from '@/components/ui'
import { useLookups } from '@/hooks/useLookups'
import {
  COMPANY_LOCATION_MAX,
  COMPANY_NAME_MAX,
  COMPANY_WEBSITE_MAX,
  isDuplicateError,
  slugify,
  validateNewCompany,
  type NewCompanyInput,
} from '@/lib/companies'
import { INDUSTRIES, LABELS } from '@/lib/options'
import type { Company } from '@/schemas/companies-schema'

export interface CreatedCompany {
  recordId: string
  name: string
  slug: string
}

interface AddCompanyFormProps {
  initialName?: string
  onCreated: (company: CreatedCompany) => void
  onCancel?: () => void
}

type Errors = Partial<Record<keyof NewCompanyInput, string>>

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive'

export function AddCompanyForm({ initialName = '', onCreated, onCancel }: AddCompanyFormProps) {
  const { ready, createConfirmed } = useMutations<Company>('companies')
  const { companyBySlug } = useLookups()
  const [input, setInput] = useState<NewCompanyInput>({
    name: initialName,
    industry: '',
    location: '',
    website: '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [existingSlug, setExistingSlug] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const update = (key: keyof NewCompanyInput, value: string) => {
    setInput((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    if (key === 'name') setExistingSlug(null)
    setFormError(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = validateNewCompany(input)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    // Fast check against what's loaded; the server's uniqueOn is the real guard.
    if (companyBySlug.has(result.fields.slug)) {
      setExistingSlug(result.fields.slug)
      return
    }

    setSaving(true)
    try {
      const recordId = await createConfirmed(result.fields as Company)
      onCreated({ recordId, name: result.fields.name, slug: result.fields.slug })
    } catch (error) {
      if (isDuplicateError(error)) setExistingSlug(result.fields.slug)
      else setFormError(error instanceof Error ? error.message : "Couldn't add the company. Try again.")
    } finally {
      setSaving(false)
    }
  }

  const fieldError = (key: keyof NewCompanyInput) =>
    errors[key] ? (
      <p id={`company-${key}-error`} className="text-xs text-destructive">
        {errors[key]}
      </p>
    ) : null

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="company-name">Company name</Label>
        <Input
          id="company-name"
          value={input.name}
          maxLength={COMPANY_NAME_MAX}
          autoComplete="organization"
          aria-invalid={!!errors.name || !!existingSlug}
          aria-describedby={errors.name ? 'company-name-error' : undefined}
          onChange={(e) => update('name', e.target.value)}
          autoFocus
        />
        {fieldError('name')}
        {existingSlug && (
          <p className="text-xs text-destructive" role="alert">
            That company already exists.{' '}
            <Link to={`/companies/${existingSlug}`} className="underline underline-offset-4">
              Open it
            </Link>
          </p>
        )}
        {!errors.name && !existingSlug && slugify(input.name) && (
          <p className="text-xs text-muted-foreground">Address: /companies/{slugify(input.name)}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="company-industry">Industry</Label>
        <select
          id="company-industry"
          value={input.industry}
          aria-invalid={!!errors.industry}
          aria-describedby={errors.industry ? 'company-industry-error' : undefined}
          onChange={(e) => update('industry', e.target.value)}
          className={selectClass}
        >
          <option value="" disabled>
            Choose an industry
          </option>
          {INDUSTRIES.map((industry) => (
            <option key={industry} value={industry}>
              {LABELS[industry]}
            </option>
          ))}
        </select>
        {fieldError('industry')}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="company-location">
          Headquarters <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="company-location"
          value={input.location}
          maxLength={COMPANY_LOCATION_MAX}
          placeholder="City, e.g. Austin, TX"
          autoComplete="off"
          aria-invalid={!!errors.location}
          aria-describedby={errors.location ? 'company-location-error' : 'company-location-hint'}
          onChange={(e) => update('location', e.target.value)}
        />
        {fieldError('location') ?? (
          <p id="company-location-hint" className="text-xs text-muted-foreground">
            Fully remote company? Enter “Remote”. Whether a specific job was remote is asked when
            sharing an experience.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="company-website">
          Website <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="company-website"
          value={input.website}
          maxLength={COMPANY_WEBSITE_MAX}
          inputMode="url"
          placeholder="example.com"
          aria-invalid={!!errors.website}
          aria-describedby={errors.website ? 'company-website-error' : undefined}
          onChange={(e) => update('website', e.target.value)}
        />
        {fieldError('website')}
      </div>

      <p className="text-xs text-muted-foreground">
        New companies show as Unverified until an admin checks them.
      </p>

      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={saving} disabled={!ready}>
          Add company
        </Button>
      </div>
    </form>
  )
}
