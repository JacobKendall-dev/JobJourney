/**
 * bookmarks — saved experiences. See docs/JobJourney Data Design.md.
 *
 * Members create and delete their own directly (no action needed): `userId`
 * must be the writer's own id (`userBound`), and `uniqueOn` refuses a second
 * bookmark of the same experience. Only the owner can read them.
 */

import type { CollectionSchema } from 'deepspace/schema'

export interface Bookmark {
  experienceId: string
  userId: string
}

export const bookmarksSchema: CollectionSchema = {
  name: 'bookmarks',
  columns: [
    { name: 'experienceId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
  ],
  uniqueOn: ['experienceId', 'userId'],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: 'own', create: true, update: false, delete: 'own' },
    // Admins bookmark like anyone (the app owner is an admin). They can read
    // and delete every bookmark, for the deleteExperience cascade, so pages
    // always filter by userId as well.
    admin: { read: true, create: true, update: false, delete: true },
  },
}
