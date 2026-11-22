/**
 * Browse filters, read from and written to the URL (useExperienceFilters).
 * Search and sort are always visible; the rest collapse behind a "Filters"
 * button on narrow screens.
 */

import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button, SearchInput } from '@/components/ui'
import { formatMonth } from '@/lib/experience'
import type { ExperienceFilters } from '@/lib/filters'
import type { Lookups } from '@/lib/lookups'
import { INDUSTRIES, INTERVIEW_FORMATS, LABELS, LEVELS, OUTCOMES, WORK_ARRANGEMENTS, labelFor } from '@/lib/options'
import { cn } from '@/lib/utils'

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50'

/** Wait this long after typing stops before updating the URL. */
const SEARCH_DELAY_MS = 250

interface FilterBarProps {
  filters: ExperienceFilters
  setFilters: (changes: Partial<ExperienceFilters>) => void
  clearFilters: () => void
  activeCount: number
  lookups: Pick<Lookups, 'companies' | 'companyBySlug' | 'positionsByCompany'>
  months: string[]
}

export function FilterBar({ filters, setFilters, clearFilters, activeCount, lookups, months }: FilterBarProps) {
  const [open, setOpen] = useState(false)

  // The search box keeps its own text so spaces survive typing (the URL value
  // is trimmed), and only writes to the URL once typing pauses.
  const [search, setSearch] = useState(filters.q ?? '')
  const lastWritten = useRef(filters.q ?? '')
  useEffect(() => {
    // The URL changed from elsewhere (Clear filters, back button, a link).
    if ((filters.q ?? '') !== lastWritten.current) {
      lastWritten.current = filters.q ?? ''
      setSearch(filters.q ?? '')
    }
  }, [filters.q])
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed === lastWritten.current) return
    const timer = setTimeout(() => {
      lastWritten.current = trimmed
      setFilters({ q: trimmed || undefined })
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search, setFilters])

  const company = filters.company ? lookups.companyBySlug.get(filters.company) : undefined
  const positions = company ? (lookups.positionsByCompany.get(company.recordId) ?? []) : []
  // Count filters other than the always-visible search, for the mobile button.
  const hiddenActive = activeCount - (filters.q ? 1 : 0)

  return (
    <div className="mb-4 flex flex-col gap-3" role="search" aria-label="Filter experiences">
      <div className="flex flex-wrap gap-2">
        <div className="min-w-[12rem] flex-1">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Search company or position"
            aria-label="Search by company or position name"
          />
        </div>
        <select
          aria-label="Sort"
          value={filters.sort}
          onChange={(e) => setFilters({ sort: e.target.value === 'helpful' ? 'helpful' : 'newest' })}
          className={cn(selectClass, 'w-auto')}
        >
          <option value="newest">Newest</option>
          <option value="helpful">Most helpful</option>
        </select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="md:hidden"
          aria-expanded={open}
          aria-controls="browse-filters"
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersHorizontal aria-hidden />
          Filters{hiddenActive > 0 ? ` (${hiddenActive})` : ''}
        </Button>
      </div>

      <div
        id="browse-filters"
        className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid md:grid-cols-4 lg:grid-cols-7', !open && 'hidden')}
      >
        <select
          aria-label="Company"
          value={filters.company ?? ''}
          onChange={(e) => setFilters({ company: e.target.value || undefined, position: undefined })}
          className={selectClass}
        >
          <option value="">All companies</option>
          {lookups.companies.map((c) => (
            <option key={c.recordId} value={c.data.slug}>
              {c.data.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Position"
          value={filters.position ?? ''}
          disabled={!company}
          title={company ? undefined : 'Choose a company first'}
          onChange={(e) => setFilters({ position: e.target.value || undefined })}
          className={selectClass}
        >
          <option value="">Any position</option>
          {positions.map((p) => (
            <option key={p.recordId} value={p.recordId}>
              {p.data.title} · {labelFor(LEVELS, p.data.level)}
            </option>
          ))}
        </select>
        <FilterSelect
          label="Outcome"
          all="Any outcome"
          value={filters.outcome}
          options={OUTCOMES}
          onChange={(outcome) => setFilters({ outcome })}
        />
        <FilterSelect
          label="Industry"
          all="Any industry"
          value={filters.industry}
          options={INDUSTRIES}
          onChange={(industry) => setFilters({ industry })}
        />
        <FilterSelect
          label="Interview format"
          all="Any format"
          value={filters.format}
          options={INTERVIEW_FORMATS}
          onChange={(format) => setFilters({ format })}
        />
        <FilterSelect
          label="Work arrangement"
          all="Any arrangement"
          value={filters.arrangement}
          options={WORK_ARRANGEMENTS}
          onChange={(arrangement) => setFilters({ arrangement })}
        />
        <select
          aria-label="Applied month"
          value={filters.month ?? ''}
          onChange={(e) => setFilters({ month: e.target.value || undefined })}
          className={selectClass}
        >
          <option value="">Any month</option>
          {/* Keep a month from the URL selectable even if no post has it now. */}
          {[...new Set([...(filters.month ? [filters.month] : []), ...months])].map((m) => (
            <option key={m} value={m}>
              {formatMonth(m) || m}
            </option>
          ))}
        </select>
      </div>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearFilters}
          className="self-start text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

function FilterSelect<T extends string>({
  label,
  all,
  value,
  options,
  onChange,
}: {
  label: string
  all: string
  value: T | undefined
  options: readonly T[]
  onChange: (value: T | undefined) => void
}) {
  return (
    <select
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}
      className={selectClass}
    >
      <option value="">{all}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {LABELS[option] ?? option}
        </option>
      ))}
    </select>
  )
}
