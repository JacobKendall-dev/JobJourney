/**
 * Admin — /admin. Signed in (the (protected) layout) and admin only.
 *
 * This role check only decides what the page shows. Every admin action
 * re-checks the role on the server with resolveAppRole. Position deletes go
 * straight to the record (the schema lets admins delete); the page hides
 * Delete for positions an experience uses.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Database, ExternalLink, ShieldCheck, Trash2 } from 'lucide-react'
import { useMutations } from 'deepspace'
import { DeleteExperienceButton } from '@/components/DeleteExperienceButton'
import { ExperienceCard, ExperienceCardSkeleton } from '@/components/ExperienceCard'
import { PageShell } from '@/components/PageShell'
import { Badge, Button, ConfirmModal, Label, Switch, useToast } from '@/components/ui'
import { useExperiences } from '@/hooks/useExperiences'
import { useLookups } from '@/hooks/useLookups'
import { useRole } from '@/hooks/useRole'
import { callAction } from '@/lib/actions'
import { buildAdminView, type AdminPosition } from '@/lib/admin'
import { displayHost, safeExternalUrl } from '@/lib/companies'
import type { CompanyRecord } from '@/lib/lookups'
import { CATEGORIES, LEVELS, labelFor } from '@/lib/options'
import type { Position } from '@/schemas/positions-schema'

const PAGE = 10

export default function AdminPage() {
  const { ready, isAdmin } = useRole()

  if (!ready) {
    return (
      <PageShell title="Admin">
        <div className="grid gap-3" aria-busy="true" aria-label="Checking your access">
          <ExperienceCardSkeleton />
          <ExperienceCardSkeleton />
        </div>
      </PageShell>
    )
  }

  if (!isAdmin) {
    return <PageShell title="Admins only" description="You don't have access to this page." />
  }

  return (
    <PageShell title="Admin" description="Verify companies, clean up and moderate posts.">
      <div className="grid gap-6">
        <SampleDataCard />
        <AdminLists />
      </div>
    </PageShell>
  )
}

function AdminLists() {
  const lookups = useLookups()
  const { experiences, status, error } = useExperiences()

  const view = useMemo(
    () => buildAdminView(lookups.companies, lookups.positions, experiences),
    [lookups.companies, lookups.positions, experiences],
  )

  if (lookups.status === 'loading' || status === 'loading') {
    return (
      <div className="grid gap-3" aria-busy="true" aria-label="Loading admin lists">
        <ExperienceCardSkeleton />
        <ExperienceCardSkeleton />
      </div>
    )
  }
  if (lookups.status === 'error' || status === 'error') {
    return (
      <Section title="Couldn't load the admin lists">
        <p className="text-sm text-destructive">{lookups.error ?? error}</p>
      </Section>
    )
  }

  const positionsLeft = (companyId: string) => lookups.positionsByCompany.get(companyId)?.length ?? 0

  return (
    <>
      <Section
        title="Unverified companies"
        count={view.unverified.length}
        description="Oldest first. Check the website, then verify."
      >
        {view.unverified.length === 0 ? (
          <Empty>Every company is verified.</Empty>
        ) : (
          <Rows>
            {view.unverified.map((c) => (
              <Row key={c.recordId}>
                <CompanyCell company={c} />
                <VerifyButton companyId={c.recordId} />
              </Row>
            ))}
          </Rows>
        )}
      </Section>

      <Section
        title="Companies with no experiences"
        count={view.unused.length}
        description="Candidates for cleanup. Deleting a company also removes its positions."
      >
        {view.unused.length === 0 ? (
          <Empty>Every company has at least one experience.</Empty>
        ) : (
          <Rows>
            {view.unused.map((c) => (
              <Row key={c.recordId}>
                <CompanyCell company={c} extra={positionCountText(positionsLeft(c.recordId))} />
                <DeleteCompanyButton companyId={c.recordId} companyName={c.data.name} />
              </Row>
            ))}
          </Rows>
        )}
      </Section>

      <Section
        title="Recent experiences"
        count={view.recent.length}
        description="Newest first. You can't see who wrote them."
      >
        {view.recent.length === 0 ? (
          <Empty>No experiences yet.</Empty>
        ) : (
          <ShowMore items={view.recent} label="experiences">
            {(e) => (
              <ExperienceCard
                key={e.recordId}
                id={e.recordId}
                experience={e.data}
                company={lookups.companyById.get(e.data.companyId)?.data}
                position={lookups.positionById.get(e.data.positionId)?.data}
                actions={<DeleteExperienceButton experienceId={e.recordId} asAdmin />}
              />
            )}
          </ShowMore>
        )}
      </Section>

      <PositionsSection positions={view.positions} unusedCount={view.unusedPositionCount} />
    </>
  )
}

/* ---------- Sections and rows ---------- */

function Section({
  title,
  count,
  description,
  actions,
  children,
}: {
  title: string
  count?: number
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            {title}
            {count !== undefined && <Badge variant="secondary">{count}</Badge>}
          </h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

const Empty = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>

const Rows = ({ children }: { children: ReactNode }) => (
  <ul className="divide-y divide-border rounded-md border border-border">{children}</ul>
)

const Row = ({ children }: { children: ReactNode }) => (
  <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5">{children}</li>
)

/** Renders PAGE items, then more on each press of Show more. */
function ShowMore<T>({ items, label, children }: { items: T[]; label: string; children: (item: T) => ReactNode }) {
  const [shown, setShown] = useState(PAGE)
  const left = items.length - shown
  return (
    <>
      <div className="grid gap-3">{items.slice(0, shown).map(children)}</div>
      {left > 0 && (
        <Button className="mt-3" variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(PAGE, left)} more {label} ({left} left)
        </Button>
      )}
    </>
  )
}

function CompanyCell({ company, extra }: { company: CompanyRecord; extra?: string }) {
  const website = safeExternalUrl(company.data.website)
  return (
    <div className="min-w-0">
      <Link
        to={`/companies/${encodeURIComponent(company.data.slug)}`}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        {company.data.name}
      </Link>
      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        {website ? (
          <a href={website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 hover:underline">
            {displayHost(website)}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : (
          <span>No website</span>
        )}
        <span>Added {formatDate(company.createdAt)}</span>
        {extra && <span>{extra}</span>}
      </p>
    </div>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? 'unknown date'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function positionCountText(n: number): string {
  return n === 0 ? 'No positions' : `${n} ${n === 1 ? 'position' : 'positions'}`
}

/* ---------- Buttons ---------- */

function VerifyButton({ companyId }: { companyId: string }) {
  const { success, error } = useToast()
  const [pending, setPending] = useState(false)

  async function verify() {
    setPending(true)
    const result = await callAction('setCompanyVerified', { companyId, verified: true })
    setPending(false)
    if (result.success) success('Company verified')
    else error("Couldn't verify the company", result.error)
  }

  return (
    <Button size="sm" variant="outline" loading={pending} onClick={verify}>
      <ShieldCheck aria-hidden />
      Verify
    </Button>
  )
}

function DeleteCompanyButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const { success, error } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function remove() {
    setPending(true)
    const result = await callAction('deleteCompany', { companyId })
    setPending(false)
    if (!result.success) {
      error("Couldn't delete the company", result.error)
      return
    }
    setOpen(false)
    success('Company deleted', `${companyName} and its positions were removed.`)
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
        Delete
      </Button>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={remove}
        title={`Delete ${companyName}?`}
        description="This also removes its positions. It can't be undone."
        confirmText="Delete company"
        variant="destructive"
        loading={pending}
      />
    </>
  )
}

/* ---------- Positions ---------- */

function PositionsSection({ positions, unusedCount }: { positions: AdminPosition[]; unusedCount: number }) {
  const [onlyUnused, setOnlyUnused] = useState(false)
  const shown = onlyUnused ? positions.filter((p) => p.uses === 0) : positions

  return (
    <Section
      title="Positions"
      count={positions.length}
      description={`${unusedCount} not used by any experience. Only unused positions can be deleted.`}
      actions={
        <div className="flex items-center gap-2">
          <Switch id="only-unused" checked={onlyUnused} onCheckedChange={setOnlyUnused} />
          <Label htmlFor="only-unused" className="text-sm">
            Only unused
          </Label>
        </div>
      }
    >
      {shown.length === 0 ? (
        <Empty>{onlyUnused ? 'Every position is in use.' : 'No positions yet.'}</Empty>
      ) : (
        <PositionRows key={String(onlyUnused)} positions={shown} />
      )}
    </Section>
  )
}

function PositionRows({ positions }: { positions: AdminPosition[] }) {
  const [shown, setShown] = useState(PAGE * 2)
  const left = positions.length - shown
  return (
    <>
      <Rows>
        {positions.slice(0, shown).map(({ position, company, uses }) => (
          <Row key={position.recordId}>
            <div className="min-w-0">
              <p className="font-medium text-foreground">{position.data.title}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                {company ? (
                  <span>{company.data.name}</span>
                ) : (
                  <Badge variant="warning" size="sm">
                    Company missing
                  </Badge>
                )}
                <span>{labelFor(LEVELS, position.data.level)}</span>
                <span>{labelFor(CATEGORIES, position.data.category)}</span>
                <span>{uses === 0 ? 'Unused' : `${uses} ${uses === 1 ? 'experience' : 'experiences'}`}</span>
              </p>
            </div>
            {uses === 0 && <DeletePositionButton positionId={position.recordId} title={position.data.title} />}
          </Row>
        ))}
      </Rows>
      {left > 0 && (
        <Button className="mt-3" variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE * 2)}>
          Show {Math.min(PAGE * 2, left)} more positions ({left} left)
        </Button>
      )}
    </>
  )
}

function DeletePositionButton({ positionId, title }: { positionId: string; title: string }) {
  const { success, error } = useToast()
  const { ready, removeConfirmed } = useMutations<Position>('positions')
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function remove() {
    setPending(true)
    try {
      await removeConfirmed(positionId)
      setOpen(false)
      success('Position deleted', `${title} was removed.`)
    } catch (err) {
      error("Couldn't delete the position", err instanceof Error ? err.message : String(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" disabled={!ready} onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
        Delete
      </Button>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={remove}
        title={`Delete ${title}?`}
        description="No experience uses this position. It can't be undone."
        confirmText="Delete position"
        variant="destructive"
        loading={pending}
      />
    </>
  )
}

/* ---------- Sample data ---------- */

function SampleDataCard() {
  const { success, error } = useToast()
  const [loading, setLoading] = useState(false)

  async function loadSampleData() {
    setLoading(true)
    const result = await callAction<{
      companiesCreated: number
      companiesUpdated: number
      positionsCreated: number
      experiencesCreated: number
    }>('seedSampleData')
    setLoading(false)
    if (!result.success) {
      error("Couldn't load sample data", result.error)
      return
    }
    const { companiesCreated, companiesUpdated, positionsCreated, experiencesCreated } = result.data
    if (companiesCreated + companiesUpdated + positionsCreated + experiencesCreated === 0) {
      success('Sample data is already loaded')
    } else {
      const parts = [
        companiesCreated > 0 && `added ${companiesCreated} companies`,
        positionsCreated > 0 && `added ${positionsCreated} positions`,
        experiencesCreated > 0 && `added ${experiencesCreated} experiences`,
        companiesUpdated > 0 && `updated ${companiesUpdated} companies`,
      ].filter(Boolean)
      const summary = parts.join(', ')
      success('Sample data loaded', `${summary.charAt(0).toUpperCase()}${summary.slice(1)}.`)
    }
  }

  return (
    <Section
      title="Sample data"
      description="Adds five clearly-labelled sample companies (Example, Sample, Demo, Placeholder) with two or three positions each, and ten sample experiences covering every outcome. Safe to run more than once: anything already there is skipped."
    >
      <Button onClick={loadSampleData} loading={loading}>
        <Database aria-hidden />
        Load sample data
      </Button>
    </Section>
  )
}
