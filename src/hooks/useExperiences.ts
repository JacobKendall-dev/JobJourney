/**
 * Every experience, live. One subscription with no `limit`, so all rows
 * arrive; filtering, counting and paging happen in the browser (the browser
 * query has no offset or total). The "Browse with filters" step adds the
 * filtering on top. Must be used under the (app)/ layout.
 */

import { useQuery } from 'deepspace'
import type { Experience } from '../lib/experience'

export function useExperiences() {
  const { records, status, error } = useQuery<Experience>('experiences')
  return { experiences: records, status, error }
}
