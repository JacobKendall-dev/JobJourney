/**
 * comments — see docs/JobJourney Data Design.md.
 *
 * - Created only by the `postComment` action, as the commenter, so
 *   `createdBy` is the commenter and `authorName` comes from their account.
 * - Members edit only `body` and `deleted` on their own comment. Deleting is
 *   soft: the UI sets `deleted: true` and `body: ""` together, so deleted
 *   text stops reaching every browser while replies keep their parent.
 * - `body` is not `required`, because a soft-deleted comment has an empty
 *   body. postComment checks 1–1,000 characters; `maxLength` caps edits.
 * - Nobody deletes directly. The deleteExperience cascade (an action) does.
 * - Comments by the experience's author show as "Owner" (`byAuthor`). They
 *   are written with the OWNER tools, like experiences, so their `createdBy`
 *   can't be matched to the author's other, named comments. The author edits
 *   and deletes them through the `updateAuthorComment` action.
 * - Replies are one level deep. Replying to a reply files the new reply
 *   under the same top-level comment (`parentId`) and remembers which reply
 *   it answers (`replyToId`).
 */

import type { CollectionSchema } from 'deepspace/schema'

export const COMMENT_MAX = 1000

export interface Comment {
  experienceId: string
  /** Empty for a top-level comment; the top-level comment's id for a reply. */
  parentId?: string
  /** For a reply to a reply: the reply it answers (same thread). */
  replyToId?: string
  /** Written by the experience's author; shown as "Owner". Stored as 0 / 1. */
  byAuthor?: 0 | 1 | boolean
  authorName?: string
  body?: string
  /** Stored as 0 / 1. Read with `isTrue`. */
  deleted?: 0 | 1 | boolean
}

export const commentsSchema: CollectionSchema = {
  name: 'comments',
  columns: [
    { name: 'experienceId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'parentId', storage: 'text', interpretation: 'plain', immutable: true },
    { name: 'replyToId', storage: 'text', interpretation: 'plain', immutable: true },
    { name: 'byAuthor', storage: 'number', interpretation: { kind: 'boolean' }, default: false, immutable: true },
    { name: 'authorName', storage: 'text', interpretation: 'plain', maxLength: 100 },
    { name: 'body', storage: 'text', interpretation: 'plain', maxLength: COMMENT_MAX },
    { name: 'deleted', storage: 'number', interpretation: { kind: 'boolean' }, default: false },
  ],
  permissions: {
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: false, update: 'own', delete: false, writableFields: ['body', 'deleted'] },
    admin: { read: true, create: false, update: true, delete: false },
  },
}
