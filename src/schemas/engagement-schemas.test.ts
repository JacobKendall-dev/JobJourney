/**
 * Permission rules for comments, helpfulVotes and bookmarks, checked with the
 * SDK's own permission functions (the ones the record room runs on writes).
 */

import { describe, expect, it } from 'vitest'
import {
  canCreate,
  canDelete,
  canRead,
  canUpdate,
  checkFieldPermissions,
  noopPermissionContext,
} from 'deepspace/server'
import { bookmarksSchema } from './bookmarks-schema'
import { commentsSchema } from './comments-schema'
import { helpfulVotesSchema } from './helpful-votes-schema'

const ctx = noopPermissionContext
const record = (createdBy: string, data: Record<string, unknown> = {}) => ({ recordId: 'r1', createdBy, data })

describe('comments', () => {
  it('everyone reads comments, signed-out visitors included', () => {
    for (const role of ['viewer', 'member', 'admin']) {
      expect(canRead(commentsSchema, role, record('someone'), 'x', ctx)).toBe(true)
    }
  })

  it('nobody creates or deletes directly — postComment and the delete cascade do', () => {
    for (const role of ['viewer', 'member', 'admin']) {
      expect(canCreate(commentsSchema, role)).toBe(false)
      expect(canDelete(commentsSchema, role, record('me'), 'me', ctx)).toBe(false)
    }
  })

  it('members edit only their own comment, and only body and deleted', () => {
    expect(canUpdate(commentsSchema, 'member', record('me'), 'me', ctx)).toBe(true)
    expect(canUpdate(commentsSchema, 'member', record('other'), 'me', ctx)).toBe(false)
    expect(canUpdate(commentsSchema, 'viewer', record('me'), 'me', ctx)).toBe(false)
    expect(checkFieldPermissions(commentsSchema, 'member', { body: 'fixed typo' })).toBeNull()
    expect(checkFieldPermissions(commentsSchema, 'member', { deleted: true, body: '' })).toBeNull()
    // byAuthor too: a member can't make their comment show as "Owner".
    for (const field of ['authorName', 'experienceId', 'parentId', 'replyToId', 'byAuthor']) {
      expect(checkFieldPermissions(commentsSchema, 'member', { [field]: 'x' })).not.toBeNull()
    }
  })

  it('caps comment length on the server', () => {
    expect(commentsSchema.columns.find((c) => c.name === 'body')?.maxLength).toBe(1000)
  })
})

describe('helpfulVotes', () => {
  it('a member reads only their own votes; visitors read none', () => {
    expect(canRead(helpfulVotesSchema, 'member', record('me'), 'me', ctx)).toBe(true)
    expect(canRead(helpfulVotesSchema, 'member', record('other'), 'me', ctx)).toBe(false)
    expect(canRead(helpfulVotesSchema, 'viewer', record('other'), 'anon', ctx)).toBe(false)
  })

  it('only toggleHelpful writes votes', () => {
    for (const role of ['viewer', 'member', 'admin']) {
      expect(canCreate(helpfulVotesSchema, role)).toBe(false)
      expect(canUpdate(helpfulVotesSchema, role, record('me'), 'me', ctx)).toBe(false)
      expect(canDelete(helpfulVotesSchema, role, record('me'), 'me', ctx)).toBe(false)
    }
  })

  it('one vote per user per experience, stamped with the voter', () => {
    expect(helpfulVotesSchema.uniqueOn).toEqual(['experienceId', 'userId'])
    expect(helpfulVotesSchema.columns.find((c) => c.name === 'userId')).toMatchObject({ userBound: true, immutable: true })
  })
})

describe('bookmarks', () => {
  it('members create and delete their own; visitors do nothing', () => {
    expect(canCreate(bookmarksSchema, 'member')).toBe(true)
    expect(canCreate(bookmarksSchema, 'viewer')).toBe(false)
    expect(canDelete(bookmarksSchema, 'member', record('me'), 'me', ctx)).toBe(true)
    expect(canDelete(bookmarksSchema, 'member', record('other'), 'me', ctx)).toBe(false)
    expect(canRead(bookmarksSchema, 'member', record('other'), 'me', ctx)).toBe(false)
    expect(canRead(bookmarksSchema, 'viewer', record('other'), 'anon', ctx)).toBe(false)
  })

  it('admins can bookmark too (the app owner is an admin)', () => {
    expect(canCreate(bookmarksSchema, 'admin')).toBe(true)
  })

  it('one bookmark per user per experience, stamped with the owner', () => {
    expect(bookmarksSchema.uniqueOn).toEqual(['experienceId', 'userId'])
    expect(bookmarksSchema.columns.find((c) => c.name === 'userId')).toMatchObject({ userBound: true, immutable: true })
  })
})
