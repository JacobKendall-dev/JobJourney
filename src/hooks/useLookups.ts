/**
 * Live companies and positions, with maps by id and by slug.
 *
 * One subscription per collection with no `limit`, so every row arrives and
 * stays live (a browser subscription without `limit` returns all rows).
 * Sorting happens here rather than with `orderBy`, because SQL ordering is
 * case-sensitive. Must be used under the (app)/ layout.
 */

import { useMemo } from 'react'
import { useQuery } from 'deepspace'
import { buildLookups, type Lookups } from '../lib/lookups'
import type { Company } from '../schemas/companies-schema'
import type { Position } from '../schemas/positions-schema'

export interface UseLookupsResult extends Lookups {
  status: 'loading' | 'ready' | 'error'
  error?: string
}

export function useLookups(): UseLookupsResult {
  const companies = useQuery<Company>('companies')
  const positions = useQuery<Position>('positions')

  const lookups = useMemo(
    () => buildLookups(companies.records, positions.records),
    [companies.records, positions.records],
  )

  const status =
    companies.status === 'error' || positions.status === 'error'
      ? 'error'
      : companies.status === 'loading' || positions.status === 'loading'
        ? 'loading'
        : 'ready'

  return { ...lookups, status, error: companies.error ?? positions.error }
}
