/**
 * Companies — /companies. Public.
 *
 * Search, industry filter and sort all run in the browser over the live
 * companies list. Experience counts come from the experiences subscription.
 * Signed-in members can add a company; it starts Unverified.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Plus, SearchX } from 'lucide-react'
import { AddCompanyForm, type CreatedCompany } from '@/components/AddCompanyForm'
import { EmptyState } from '@/components/EmptyState'
import { PageShell } from '@/components/PageShell'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { Button, Modal, SearchInput, useToast } from '@/components/ui'
import { useExperiences } from '@/hooks/useExperiences'
import { useLookups } from '@/hooks/useLookups'
import { useRole } from '@/hooks/useRole'
import { INDUSTRIES, LABELS, isOneOf, isTrue, labelFor } from '@/lib/options'
import { countBy } from '@/lib/stats'

type Sort = 'experiences' | 'name'

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

export default function CompaniesPage() {
  const navigate = useNavigate()
  const { success } = useToast()
  const { isSignedIn } = useRole()
  const { status, error, companies } = useLookups()
  const { experiences, status: experiencesStatus } = useExperiences()

  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('')
  const [sort, setSort] = useState<Sort>('experiences')
  const [adding, setAdding] = useState<{ name: string } | null>(null)

  const counts = useMemo(() => countBy(experiences, 'companyId'), [experiences])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    const matches = companies.filter(
      (c) =>
        (!term || c.data.name.toLowerCase().includes(term)) &&
        (!industry || c.data.industry === industry ||
          (industry === 'other' && !isOneOf(INDUSTRIES, c.data.industry))),
    )
    // `companies` is already A–Z, and sort is stable, so ties stay A–Z.
    return sort === 'experiences'
      ? [...matches].sort((a, b) => (counts.get(b.recordId) ?? 0) - (counts.get(a.recordId) ?? 0))
      : matches
  }, [companies, search, industry, sort, counts])

  function handleCreated(company: CreatedCompany) {
    setAdding(null)
    success('Company added', `${company.name} shows as Unverified until an admin checks it.`)
    navigate(`/companies/${company.slug}`)
  }

  const filtering = search.trim() !== '' || industry !== ''

  return (
    <PageShell
      title="Companies"
      description="Every company with shared experiences."
      actions={
        isSignedIn ? (
          <Button onClick={() => setAdding({ name: '' })}>
            <Plus aria-hidden />
            Add a company
          </Button>
        ) : undefined
      }
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Search companies"
            aria-label="Search companies by name"
          />
        </div>
        <select
          aria-label="Industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className={selectClass}
        >
          <option value="">All industries</option>
          {INDUSTRIES.map((value) => (
            <option key={value} value={value}>
              {LABELS[value]}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className={selectClass}
        >
          <option value="experiences">Most experiences</option>
          <option value="name">A–Z</option>
        </select>
      </div>

      {status === 'loading' ? (
        <ul className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading companies">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="h-24 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </ul>
      ) : status === 'error' ? (
        <EmptyState
          icon={<Building2 aria-hidden />}
          title="Couldn't load companies."
          description={error}
        />
      ) : companies.length === 0 ? (
        <EmptyState
          icon={<Building2 aria-hidden />}
          title="No companies yet."
          description="Companies appear here as people share experiences."
          action={{ label: 'Share an experience', to: '/experiences/new' }}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<SearchX aria-hidden />}
          title={search.trim() ? `No company called “${search.trim()}” yet.` : 'No companies match.'}
          description={isSignedIn && search.trim() ? 'Add it so others can find it too.' : undefined}
          action={
            isSignedIn && search.trim()
              ? { label: 'Add it', onClick: () => setAdding({ name: search.trim() }) }
              : undefined
          }
          secondaryAction={
            filtering
              ? {
                  label: 'Clear search',
                  onClick: () => {
                    setSearch('')
                    setIndustry('')
                  },
                }
              : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((company) => {
            const count = counts.get(company.recordId) ?? 0
            return (
              <li
                key={company.recordId}
                className="relative flex flex-col gap-1 rounded-lg border border-border bg-card p-4 transition-colors focus-within:ring-2 focus-within:ring-ring hover:border-muted-foreground/50"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    to={`/companies/${company.data.slug}`}
                    className="font-semibold text-foreground outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
                  >
                    {company.data.name}
                  </Link>
                  {isTrue(company.data.verified) ? (
                    <VerifiedBadge verified={company.data.verified} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Unverified</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {[labelFor(INDUSTRIES, company.data.industry), company.data.location]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {experiencesStatus === 'loading'
                    ? ' '
                    : `${count} ${count === 1 ? 'experience' : 'experiences'}`}
                </p>
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={adding !== null} onClose={() => setAdding(null)} size="sm">
        <Modal.Header>
          <Modal.Title>Add a company</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {adding && (
            <AddCompanyForm
              initialName={adding.name}
              onCreated={handleCreated}
              onCancel={() => setAdding(null)}
            />
          )}
        </Modal.Body>
      </Modal>
    </PageShell>
  )
}
