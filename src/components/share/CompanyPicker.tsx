/**
 * Search-as-you-type company picker for the share form, with "+ Add" for a
 * company that isn't listed yet (opens AddCompanyForm in a modal).
 */

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { AddCompanyForm, type CreatedCompany } from '@/components/AddCompanyForm'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { Button, Modal, SearchInput } from '@/components/ui'
import { useLookups } from '@/hooks/useLookups'
import { INDUSTRIES, isTrue, labelFor } from '@/lib/options'

const MAX_RESULTS = 8

export function CompanyPicker({
  value,
  onChange,
  error,
}: {
  value: string | null
  onChange: (companyId: string | null) => void
  error?: string
}) {
  const { companies, companyById, status } = useLookups()
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  // A just-created company may arrive in the live list a moment after the
  // server confirms it; show its name meanwhile.
  const [justCreated, setJustCreated] = useState<CreatedCompany | null>(null)

  const term = search.trim().toLowerCase()
  const results = useMemo(
    () =>
      (term ? companies.filter((c) => c.data.name.toLowerCase().includes(term)) : companies).slice(
        0,
        MAX_RESULTS,
      ),
    [companies, term],
  )
  const exactMatch = companies.some((c) => c.data.name.toLowerCase() === term)

  if (value) {
    const selected = companyById.get(value)
    const name = selected?.data.name ?? (justCreated?.recordId === value ? justCreated.name : 'Selected company')
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-foreground">{name}</span>
          {selected && isTrue(selected.data.verified) ? (
            <VerifiedBadge verified={selected.data.verified} />
          ) : (
            <span className="text-xs text-muted-foreground">Unverified</span>
          )}
          {selected && (
            <span className="text-xs text-muted-foreground">
              {labelFor(INDUSTRIES, selected.data.industry)}
            </span>
          )}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <SearchInput
        id="share-company"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch('')}
        placeholder="Search companies"
        aria-invalid={!!error}
        aria-describedby={error ? 'share-company-error' : undefined}
        autoComplete="off"
      />
      <ul className="flex flex-col overflow-hidden rounded-lg border border-border" aria-label="Matching companies">
        {status === 'loading' && <li className="px-3 py-2 text-sm text-muted-foreground">Loading companies…</li>}
        {results.map((company) => (
          <li key={company.recordId} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => onChange(company.recordId)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            >
              <span className="text-foreground">{company.data.name}</span>
              <span className="text-xs text-muted-foreground">
                {isTrue(company.data.verified) ? 'Verified' : 'Unverified'}
              </span>
            </button>
          </li>
        ))}
        {status === 'ready' && results.length === 0 && term && (
          <li className="px-3 py-2 text-sm text-muted-foreground">No company called “{search.trim()}” yet.</li>
        )}
        {status === 'ready' && term && !exactMatch && (
          <li className="border-t border-border">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            >
              <Plus className="size-4" aria-hidden />
              Add “{search.trim()}”
            </button>
          </li>
        )}
      </ul>
      {!term && (
        <p className="text-xs text-muted-foreground">
          Not listed? Type its name and choose “Add”.
        </p>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} size="sm">
        <Modal.Header>
          <Modal.Title>Add a company</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {adding && (
            <AddCompanyForm
              initialName={search.trim()}
              onCancel={() => setAdding(false)}
              onCreated={(company) => {
                setJustCreated(company)
                setAdding(false)
                setSearch('')
                onChange(company.recordId)
              }}
            />
          )}
        </Modal.Body>
      </Modal>
    </div>
  )
}
