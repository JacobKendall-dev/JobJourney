/**
 * positions — see docs/JobJourney Data Design.md.
 *
 * - Members can't write positions directly: a new position is added by
 *   createExperience when the post is shared, so an abandoned share form
 *   leaves nothing behind, and the position's createdBy is the app owner
 *   rather than the (possibly anonymous) author. Admins manage.
 * - `uniqueOn` stops the same title + level being added twice for a company.
 *   It compares exact text, so titles are trimmed and spaces collapsed first.
 * - Nothing checks that `companyId` points at a real company; the admin page
 *   watches for strays. Admins can delete a position directly, so the admin
 *   page hides Delete while experiences use it.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { CATEGORIES, LEVELS, type Category, type Level } from '../lib/options'

export interface Position {
  companyId: string
  title: string
  /** One of LEVELS when written by the app; display with `labelFor`. */
  level: Level | string
  /** One of CATEGORIES when written by the app; display with `labelFor`. */
  category: Category | string
}

export const positionsSchema: CollectionSchema = {
  name: 'positions',
  columns: [
    { name: 'companyId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'title', storage: 'text', interpretation: 'plain', required: true, maxLength: 100 },
    {
      name: 'level',
      storage: 'text',
      interpretation: { kind: 'select', options: [...LEVELS] },
      required: true,
    },
    {
      name: 'category',
      storage: 'text',
      interpretation: { kind: 'select', options: [...CATEGORIES] },
      required: true,
    },
  ],
  uniqueOn: ['companyId', 'title', 'level'],
  permissions: {
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
