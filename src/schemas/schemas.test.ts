/**
 * Permission rules for companies, positions and users, checked with the SDK's
 * own permission functions (the ones the record room runs on every write).
 * The two-account browser tests come with the pages that write these.
 */

import { describe, expect, it } from 'vitest'
import {
  canCreate,
  canDelete,
  canRead,
  canUpdate,
  checkFieldPermissions,
  lintSchemas,
  noopPermissionContext,
} from 'deepspace/server'
import { schemas } from '../schemas'
import { companiesSchema } from './companies-schema'
import { positionsSchema } from './positions-schema'
import { usersSchema } from './users-schema'

const record = (createdBy = 'user-a', data: Record<string, unknown> = {}) => ({
  recordId: 'r1',
  createdBy,
  data,
})

const newCompany = {
  name: 'Example Technologies',
  slug: 'example-technologies',
  industry: 'technology',
  location: 'Remote',
  website: 'https://example.com',
}

describe('schema set', () => {
  it('has no schema lint warnings', () => {
    expect(lintSchemas(schemas)).toEqual([])
  })
})

describe('companies', () => {
  it('everyone can read, including signed-out visitors', () => {
    for (const role of ['viewer', 'member', 'admin']) {
      expect(canRead(companiesSchema, role, record(), 'someone', noopPermissionContext)).toBe(true)
    }
  })

  it('members can create with the allowed fields', () => {
    expect(canCreate(companiesSchema, 'member')).toBe(true)
    expect(checkFieldPermissions(companiesSchema, 'member', newCompany)).toBeNull()
  })

  it('signed-out visitors cannot create', () => {
    expect(canCreate(companiesSchema, 'viewer')).toBe(false)
  })

  it.each(['verified', 'verifiedBy', 'verifiedAt'])('members cannot send %s', (field) => {
    const value = field === 'verified' ? true : 'x'
    expect(
      checkFieldPermissions(companiesSchema, 'member', { ...newCompany, [field]: value }),
    ).not.toBeNull()
  })

  it('members cannot update, even their own company', () => {
    expect(canUpdate(companiesSchema, 'member', record('me'), 'me', noopPermissionContext)).toBe(false)
  })

  it('admins can update (including verified) but nobody deletes directly', () => {
    expect(canUpdate(companiesSchema, 'admin', record(), 'admin-1', noopPermissionContext)).toBe(true)
    expect(checkFieldPermissions(companiesSchema, 'admin', { verified: true })).toBeNull()
    for (const role of ['viewer', 'member', 'admin']) {
      expect(canDelete(companiesSchema, role, record('me'), 'me', noopPermissionContext)).toBe(false)
    }
  })

  it('new companies default to unverified, and slugs are unique', () => {
    const verified = companiesSchema.columns.find((c) => c.name === 'verified')
    expect(verified?.default).toBe(false)
    expect(companiesSchema.uniqueOn).toEqual(['slug'])
  })
})

describe('positions', () => {
  const newPosition = { companyId: 'c1', title: 'Software Engineer Intern', level: 'intern', category: 'software' }

  it('members can create with the allowed fields, visitors cannot', () => {
    expect(canCreate(positionsSchema, 'member')).toBe(true)
    expect(checkFieldPermissions(positionsSchema, 'member', newPosition)).toBeNull()
    expect(canCreate(positionsSchema, 'viewer')).toBe(false)
  })

  it('members cannot update or delete; admins can', () => {
    expect(canUpdate(positionsSchema, 'member', record('me'), 'me', noopPermissionContext)).toBe(false)
    expect(canDelete(positionsSchema, 'member', record('me'), 'me', noopPermissionContext)).toBe(false)
    expect(canDelete(positionsSchema, 'admin', record(), 'admin-1', noopPermissionContext)).toBe(true)
  })

  it('the same title and level cannot be added twice for a company', () => {
    expect(positionsSchema.uniqueOn).toEqual(['companyId', 'title', 'level'])
  })
})

describe('users', () => {
  it('members see only themselves in the user list', () => {
    expect(usersSchema.roster).toBe('read-policy')
    expect(canRead(usersSchema, 'member', record('other'), 'me', noopPermissionContext)).toBe(false)
  })
})
