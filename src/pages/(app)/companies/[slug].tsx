/**
 * Company profile — /companies/:slug. Public.
 *
 * The URL holds the slug; the page looks up the company id. Stats, position
 * counts and the experience list are computed in the browser from the live
 * experiences subscription. `?position=<id>` filters the experiences.
 * Admins get Verify / Remove verification and Delete; both are actions that
 * re-check the role on the server.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Building2, ExternalLink, MessageSquarePlus, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ExperienceCard, ExperienceCardSkeleton } from '@/components/ExperienceCard'
import { PageShell } from '@/components/PageShell'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { Button, ConfirmModal, buttonVariants, useToast } from '@/components/ui'
import { useExperiences } from '@/hooks/useExperiences'
import { useLookups } from '@/hooks/useLookups'
import { useRole } from '@/hooks/useRole'
import { callAction } from '@/lib/actions'
import { displayHost, safeExternalUrl } from '@/lib/companies'
import { CATEGORIES, INDUSTRIES, LEVELS, OUTCOMES, LABELS, isTrue, labelFor } from '@/lib/options'
import { companyStats, countBy, sortExperiences, type ExperienceSort } from '@/lib/stats'
import { cn } from '@/lib/utils'

export default function CompanyProfilePage() {
  const { slug = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { status, companyBySlug, positionsByCompany, positionById } = useLookups()
  const { experiences, status: experiencesStatus } = useExperiences()
  const { isAdmin } = useRole()

  const company = companyBySlug.get(slug)
  const companyId = company?.recordId
  const positions = useMemo(
    () => (companyId ? (positionsByCompany.get(companyId) ?? []) : []),
    [companyId, positionsByCompany],
  )
  const companyExperiences = useMemo(
    () => (companyId ? experiences.filter((e) => e.data.companyId === companyId) : []),
    [companyId, experiences],
  )
  const positionCounts = useMemo(() => countBy(companyExperiences, 'positionId'), [companyExperiences])
  const stats = useMemo(() => companyStats(companyExperiences), [companyExperiences])

  const positionParam = searchParams.get('position')
  const selectedPosition = positions.find((p) => p.recordId === positionParam)
  const sort: ExperienceSort = searchParams.get('sort') === 'helpful' ? 'helpful' : 'newest'

  const listed = useMemo(
    () =>
      sortExperiences(
        selectedPosition
          ? companyExperiences.filter((e) => e.data.positionId === selectedPosition.recordId)
          : companyExperiences,
        sort,
      ),
    [companyExperiences, selectedPosition, sort],
  )

  const setParam = (key: string, value: string | null) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  if (status === 'loading') {
    return (
      <PageShell title={<span className="inline-block h-7 w-56 animate-pulse rounded bg-muted" />}>
        <ExperienceCardSkeleton />
      </PageShell>
    )
  }

  if (!company) {
    return (
      <PageShell title="Company not found">
        <EmptyState
          icon={<Building2 aria-hidden />}
          title="We don't have a company at this address."
          description="It may have been removed, or the link has a typo."
          action={{ label: 'See all companies', to: '/companies' }}
          secondaryAction={{ label: 'Browse experiences', to: '/experiences' }}
        />
      </PageShell>
    )
  }

  const website = safeExternalUrl(company.data.website)
  const verified = isTrue(company.data.verified)
  const shareHref = `/experiences/new?company=${encodeURIComponent(company.data.slug)}`

  return (
    <PageShell
      title={company.data.name}
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {verified ? (
            <VerifiedBadge verified={company.data.verified} />
          ) : (
            <span>Unverified · added by the community</span>
          )}
          <span aria-hidden>·</span>
          <span>{labelFor(INDUSTRIES, company.data.industry)}</span>
          {company.data.location && (
            <>
              <span aria-hidden>·</span>
              <span>{company.data.location}</span>
            </>
          )}
          {website && (
            <>
              <span aria-hidden>·</span>
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
              >
                {displayHost(website)}
                <ExternalLink className="size-3" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </>
          )}
        </span>
      }
      actions={
        <Link to={shareHref} className={buttonVariants()}>
          <MessageSquarePlus aria-hidden />
          Share an experience here
        </Link>
      }
    >
      {isAdmin && (
        <AdminControls
          companyId={company.recordId}
          companyName={company.data.name}
          verified={verified}
          experienceCount={experiencesStatus === 'ready' ? stats.count : undefined}
        />
      )}

      <section aria-labelledby="glance-heading" className="mb-8">
        <h2 id="glance-heading" className="mb-3 text-sm font-semibold text-muted-foreground">
          At a glance
        </h2>
        {experiencesStatus === 'loading' ? (
          <div className="h-20 animate-pulse rounded-lg border border-border bg-card" />
        ) : stats.count === 0 ? (
          <p className="text-sm text-muted-foreground">No experiences shared for this company yet.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Experiences" value={String(stats.count)} />
            <Stat
              label="Outcomes"
              value={
                OUTCOMES.filter((o) => stats.outcomes[o] > 0)
                  .map((o) => `${stats.outcomes[o]} ${LABELS[o].toLowerCase()}`)
                  .join(' · ') || '—'
              }
            />
            <Stat
              label="Typical first response"
              value={
                stats.medianFirstResponseDays === undefined
                  ? '—'
                  : `${Math.round(stats.medianFirstResponseDays)} ${
                      Math.round(stats.medianFirstResponseDays) === 1 ? 'day' : 'days'
                    }`
              }
            />
            <Stat
              label="Typical interview stages"
              value={stats.medianStages === undefined ? '—' : String(Math.round(stats.medianStages))}
            />
          </dl>
        )}
      </section>

      <section aria-labelledby="positions-heading" className="mb-8">
        <h2 id="positions-heading" className="mb-3 text-sm font-semibold text-muted-foreground">
          Positions
        </h2>
        {positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No positions added yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter experiences by position">
            <PositionChip
              label="All positions"
              count={stats.count}
              selected={!selectedPosition}
              onClick={() => setParam('position', null)}
            />
            {positions.map((p) => (
              <PositionChip
                key={p.recordId}
                label={`${p.data.title} · ${labelFor(LEVELS, p.data.level)}`}
                title={labelFor(CATEGORIES, p.data.category)}
                count={positionCounts.get(p.recordId) ?? 0}
                selected={selectedPosition?.recordId === p.recordId}
                onClick={() => setParam('position', p.recordId)}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="experiences-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="experiences-heading" className="text-sm font-semibold text-muted-foreground">
            {selectedPosition ? `Experiences · ${selectedPosition.data.title}` : 'Experiences'}
          </h2>
          <select
            aria-label="Sort experiences"
            value={sort}
            onChange={(e) => setParam('sort', e.target.value === 'helpful' ? 'helpful' : null)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="newest">Newest</option>
            <option value="helpful">Most helpful</option>
          </select>
        </div>

        {experiencesStatus === 'loading' ? (
          <div className="grid gap-3">
            <ExperienceCardSkeleton />
            <ExperienceCardSkeleton />
          </div>
        ) : listed.length === 0 ? (
          <EmptyState
            icon={<MessageSquarePlus aria-hidden />}
            title={
              selectedPosition
                ? `No experiences for ${selectedPosition.data.title} yet.`
                : `No experiences for ${company.data.name} yet.`
            }
            description="Applied here? Your experience helps the next person."
            action={{ label: 'Share an experience here', to: shareHref }}
          />
        ) : (
          <div className="grid gap-3">
            {listed.map((e) => (
              <ExperienceCard
                key={e.recordId}
                id={e.recordId}
                experience={e.data}
                company={company.data}
                position={positionById.get(e.data.positionId)?.data}
              />
            ))}
          </div>
        )}
      </section>
    </PageShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  )
}

function PositionChip({
  label,
  title,
  count,
  selected,
  onClick,
}: {
  label: string
  title?: string
  count: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary bg-primary/15 text-foreground'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {label} <span className="text-xs text-muted-foreground">({count})</span>
    </button>
  )
}

function AdminControls({
  companyId,
  companyName,
  verified,
  experienceCount,
}: {
  companyId: string
  companyName: string
  verified: boolean
  /** Undefined while experiences are loading. */
  experienceCount?: number
}) {
  const navigate = useNavigate()
  const { success, error } = useToast()
  const [pending, setPending] = useState<'verify' | 'delete' | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  async function toggleVerified() {
    setPending('verify')
    const result = await callAction('setCompanyVerified', { companyId, verified: !verified })
    setPending(null)
    if (result.success) success(verified ? 'Verification removed' : 'Company verified')
    else error("Couldn't change verification", result.error)
  }

  async function deleteCompany() {
    setPending('delete')
    const result = await callAction('deleteCompany', { companyId })
    setPending(null)
    setConfirmingDelete(false)
    if (result.success) {
      success('Company deleted', `${companyName} and its positions were removed.`)
      navigate('/companies')
    } else {
      error("Couldn't delete the company", result.error)
    }
  }

  const canDelete = experienceCount === 0

  return (
    <section
      aria-label="Admin controls"
      className="mb-8 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3"
    >
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Admin
      </span>
      <Button variant="outline" size="sm" loading={pending === 'verify'} disabled={pending !== null} onClick={toggleVerified}>
        {verified ? <ShieldOff aria-hidden /> : <ShieldCheck aria-hidden />}
        {verified ? 'Remove verification' : 'Verify'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!canDelete || pending !== null}
        onClick={() => setConfirmingDelete(true)}
      >
        <Trash2 aria-hidden />
        Delete company
      </Button>
      {experienceCount !== undefined && experienceCount > 0 && (
        <span className="text-xs text-muted-foreground">
          Has {experienceCount} {experienceCount === 1 ? 'experience' : 'experiences'}; delete those first.
        </span>
      )}
      <ConfirmModal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={deleteCompany}
        title={`Delete ${companyName}?`}
        description="This also removes its positions. It can't be undone."
        confirmText="Delete company"
        variant="destructive"
        loading={pending === 'delete'}
      />
    </section>
  )
}
