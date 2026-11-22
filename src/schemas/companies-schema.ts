/**
 * companies — see docs/JobJourney Data Design.md.
 *
 * - Members create companies directly, but only the fields in
 *   `writableFields`. Sending `verified`, `verifiedBy` or `verifiedAt` is
 *   refused by the server, and `verified` defaults to false (a default doesn't
 *   count as a member write), so new companies always start unverified.
 * - `uniqueOn: ['slug']` makes a duplicate slug a server-side "Duplicate" error.
 * - Admins update anything (verification goes through `setCompanyVerified` so
 *   `verifiedBy` is set by the server). Nobody deletes directly: deleting goes
 *   through the `deleteCompany` action, which refuses while experiences exist.
 * - `verifiedAt` is stamped by the server when `verified` becomes true.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { INDUSTRIES, type Industry } from '../lib/options'

export interface Company {
  name: string
  slug: string
  /** One of INDUSTRIES when written by the app; display with `labelFor`. */
  industry: Industry | string
  location?: string
  website?: string
  /** Stored as 0 / 1. Read with `isTrue`. */
  verified: 0 | 1 | boolean
  verifiedBy?: string
  /** ISO timestamp, set by the server. */
  verifiedAt?: string
}

/** Fields a member may send when creating a company. */
export const COMPANY_MEMBER_FIELDS = ['name', 'slug', 'industry', 'location', 'website'] as const

export const companiesSchema: CollectionSchema = {
  name: 'companies',
  columns: [
    { name: 'name', storage: 'text', interpretation: 'plain', required: true, maxLength: 100 },
    { name: 'slug', storage: 'text', interpretation: 'plain', required: true, maxLength: 100 },
    {
      name: 'industry',
      storage: 'text',
      interpretation: { kind: 'select', options: [...INDUSTRIES] },
      required: true,
    },
    { name: 'location', storage: 'text', interpretation: 'plain', maxLength: 100 },
    { name: 'website', storage: 'text', interpretation: { kind: 'url' }, maxLength: 200 },
    {
      name: 'verified',
      storage: 'number',
      interpretation: { kind: 'boolean', trueLabel: 'Verified', falseLabel: 'Unverified' },
      default: false,
    },
    { name: 'verifiedBy', storage: 'text', interpretation: 'plain' },
    {
      name: 'verifiedAt',
      storage: 'text',
      interpretation: { kind: 'datetime' },
      timestampTrigger: { field: 'verified', value: true },
    },
  ],
  uniqueOn: ['slug'],
  permissions: {
    viewer: { read: true, create: false, update: false, delete: false },
    member: {
      read: true,
      create: true,
      update: false,
      delete: false,
      writableFields: [...COMPANY_MEMBER_FIELDS],
    },
    // delete: false — use the deleteCompany action.
    admin: { read: true, create: true, update: true, delete: false },
  },
}
