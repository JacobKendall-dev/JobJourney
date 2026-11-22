/**
 * experienceAuthors — who wrote each experience. PRIVATE.
 *
 * Written only by actions, as the author (normal caller tools), so the row's
 * built-in `createdBy` IS the author and `read: 'own'` returns it only to them.
 * Nobody — admins included — can read another person's row. Admins moderate
 * with deleteExperience and never need to know who wrote a post.
 *
 * The public `experiences` record holds no author id and is written as the
 * app owner, so this collection is the only place authorship exists.
 */

import type { CollectionSchema } from 'deepspace/schema'

export interface ExperienceAuthor {
  experienceId: string
}

const actionOnly = { create: false, update: false, delete: false } as const

export const experienceAuthorsSchema: CollectionSchema = {
  name: 'experienceAuthors',
  columns: [
    { name: 'experienceId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
  ],
  uniqueOn: ['experienceId'],
  permissions: {
    viewer: { read: false, ...actionOnly },
    member: { read: 'own', ...actionOnly },
    admin: { read: 'own', ...actionOnly },
  },
}
