import { USERS_COLUMNS, type CollectionSchema } from 'deepspace/schema'

/** The app's own fields on a user's row (the SDK adds email, name and the rest). */
export interface UserPrefs {
  /** Daily email when people comment on your posts. Off unless turned on. Stored as 0 / 1. */
  notifyComments?: 0 | 1 | boolean
}

export const usersSchema: CollectionSchema = {
  name: 'users',
  columns: [
    ...USERS_COLUMNS,
    { name: 'notifyComments', storage: 'number', interpretation: { kind: 'boolean' }, default: false },
  ],
  permissions: {
    viewer: { read: 'own', create: false, update: 'own', delete: false },
    member: { read: 'own', create: false, update: 'own', delete: false },
    admin: { read: true, create: false, update: true, delete: true },
  },
  // Members see only themselves in the user list (useUsers / user.list),
  // instead of every member's name and lastSeenAt. Without this, someone could
  // match an anonymous post's time to who was online. Admins still see
  // everyone. Comments store their own authorName, so they don't need the list.
  roster: 'read-policy',
}
