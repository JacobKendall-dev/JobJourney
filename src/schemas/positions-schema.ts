/**
 * positions — see docs/JobJourney Data Design.md.
 *
 * - Members create positions directly (only `writableFields`); admins manage.
 * - `uniqueOn` stops the same title + level being added twice for a company.
 *   It compares exact text, so the form should trim titles before saving.
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

/** Fields a member may send when creating a position. */
export const POSITION_MEMBER_FIELDS = ['companyId', 'title', 'level', 'category'] as const

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
    member: {
      read: true,
      create: true,
      update: false,
      delete: false,
      writableFields: [...POSITION_MEMBER_FIELDS],
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
