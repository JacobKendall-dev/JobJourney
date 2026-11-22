/**
 * experiences — see docs/JobJourney Data Design.md.
 *
 * Public to read (signed-out visitors included). Every write goes through an
 * action, never the browser: no role can create, update or delete directly.
 * Actions write experiences under the app owner's identity, so `createdBy` on
 * every experience is the owner and never reveals the author. Authorship lives
 * in the private `experienceAuthors` collection (added with createExperience).
 */

import type { CollectionSchema } from 'deepspace/schema'
import { OUTCOMES, WORK_ARRANGEMENTS } from '../lib/options'

export type { Experience } from '../lib/experience'

const readOnly = { read: true, create: false, update: false, delete: false } as const

export const experiencesSchema: CollectionSchema = {
  name: 'experiences',
  columns: [
    { name: 'companyId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'positionId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'isAnonymous', storage: 'number', interpretation: { kind: 'boolean' }, default: true },
    { name: 'authorName', storage: 'text', interpretation: 'plain', maxLength: 100 },
    { name: 'appliedMonth', storage: 'text', interpretation: 'plain', required: true, maxLength: 7 },
    { name: 'firstResponseDays', storage: 'number', interpretation: 'plain' },
    { name: 'noResponse', storage: 'number', interpretation: { kind: 'boolean' }, default: false },
    { name: 'interviewStages', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'interviewFormats', storage: 'text', interpretation: { kind: 'json' }, maxLength: 500 },
    {
      name: 'outcome',
      storage: 'text',
      interpretation: { kind: 'select', options: [...OUTCOMES] },
      required: true,
    },
    // Optional. Where the job was done; the company's `location` is its headquarters.
    {
      name: 'workArrangement',
      storage: 'text',
      interpretation: { kind: 'select', options: [...WORK_ARRANGEMENTS] },
    },
    { name: 'interviewExperience', storage: 'text', interpretation: 'plain', maxLength: 2000 },
    { name: 'advice', storage: 'text', interpretation: 'plain', maxLength: 2000 },
    // Number storage so "most helpful" sorts numerically. Set only by actions.
    { name: 'helpfulCount', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'commentCount', storage: 'number', interpretation: 'plain', default: 0 },
  ],
  permissions: {
    viewer: readOnly,
    member: readOnly,
    admin: readOnly,
  },
}
