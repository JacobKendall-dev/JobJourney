/**
 * Which experiences the signed-in user wrote, from their own private
 * `experienceAuthors` rows. Everyone (admins included) can read only their
 * own rows; the `createdBy` filter states that intent explicitly too.
 * Must be used under the (app)/ layout.
 */

import { useMemo } from 'react'
import { useQuery } from 'deepspace'
import type { ExperienceAuthor } from '../schemas/experience-authors-schema'

export function useMyAuthorship(userId: string | null) {
  const { records, status, error } = useQuery<ExperienceAuthor>(
    'experienceAuthors',
    // Signed out: a filter that matches nothing (viewers can't read these anyway).
    { where: { createdBy: userId ?? '__signed_out__' } },
  )
  const experienceIds = useMemo(
    () => new Set(records.filter((r) => r.createdBy === userId).map((r) => r.data.experienceId)),
    [records, userId],
  )
  return { experienceIds, rows: records, status, error }
}
