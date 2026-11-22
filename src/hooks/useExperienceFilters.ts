/**
 * Experience filters that live in the URL, so a filtered view can be shared
 * or bookmarked and links (home search, company pages) land pre-filtered.
 *
 * Updates replace the current history entry instead of adding one, so typing
 * a search doesn't fill the back button with every keystroke.
 */

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DEFAULT_SORT,
  activeFilterCount,
  parseFilters,
  toSearchParams,
  type ExperienceFilters,
} from '../lib/filters'

export function useExperienceFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])

  /** Change some filters; pass `undefined` to remove one. Other filters stay. */
  const setFilters = useCallback(
    (changes: Partial<ExperienceFilters>) => {
      setSearchParams(
        (current) => {
          const next = { ...parseFilters(current), ...changes }
          if (!next.sort) next.sort = DEFAULT_SORT
          return toSearchParams(next)
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  /** Remove every filter but keep the chosen sort. */
  const clearFilters = useCallback(() => {
    setSearchParams((current) => toSearchParams({ sort: parseFilters(current).sort }), {
      replace: true,
    })
  }, [setSearchParams])

  return { filters, setFilters, clearFilters, activeCount: activeFilterCount(filters) }
}
