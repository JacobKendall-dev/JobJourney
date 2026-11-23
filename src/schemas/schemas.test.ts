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
import { experiencesSchema } from './experiences-schema'
import { experienceAuthorsSchema } from './experience-authors-schema'
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

  // The SDK checks maxLength against the raw value before JSON or number
  // conversion and refuses anything that isn't a string, so maxLength on any
  // other column makes every write to it fail.
  it('puts maxLength only on plain text columns', () => {
    for (const schema of schemas) {
      for (const column of schema.columns) {
        if (column.maxLength === undefined) continue
        const kind = typeof column.interpretation === 'string' ? column.interpretation : column.interpretation.kind
        expect(`${schema.name}.${column.name}: ${column.storage} ${kind}`).toMatch(/: text (plain|url|email)$/)
      }
    }
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
  it('only admins create directly; members add positions through createExperience', () => {
    expect(canCreate(positionsSchema, 'member')).toBe(false)
    expect(canCreate(positionsSchema, 'viewer')).toBe(false)
    expect(canCreate(positionsSchema, 'admin')).toBe(true)
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

describe('experiences', () => {
  it('everyone can read, including signed-out visitors', () => {
    for (const role of ['viewer', 'member', 'admin']) {
      expect(canRead(experiencesSchema, role, record(), 'someone', noopPermissionContext)).toBe(true)
    }
  })

  it('no role writes directly — every write goes through an action', () => {
    for (const role of ['viewer', 'member', 'admin']) {
      expect(canCreate(experiencesSchema, role)).toBe(false)
      expect(canUpdate(experiencesSchema, role, record('me'), 'me', noopPermissionContext)).toBe(false)
      expect(canDelete(experiencesSchema, role, record('me'), 'me', noopPermissionContext)).toBe(false)
    }
  })

  it('company and position can never change', () => {
    const immutable = experiencesSchema.columns.filter((c) => c.immutable).map((c) => c.name)
    expect(immutable).toEqual(['companyId', 'positionId'])
  })
})

describe('experienceAuthors', () => {
  it('only the author can read their row — not visitors, other members, or admins', () => {
    const mine = record('me', { experienceId: 'e1' })
    expect(canRead(experienceAuthorsSchema, 'member', mine, 'me', noopPermissionContext)).toBe(true)
    expect(canRead(experienceAuthorsSchema, 'admin', mine, 'me', noopPermissionContext)).toBe(true)
    expect(canRead(experienceAuthorsSchema, 'member', mine, 'someone-else', noopPermissionContext)).toBe(false)
    expect(canRead(experienceAuthorsSchema, 'admin', mine, 'an-admin', noopPermissionContext)).toBe(false)
    expect(canRead(experienceAuthorsSchema, 'viewer', mine, 'anon-1', noopPermissionContext)).toBe(false)
  })

  it('nobody writes it directly — only actions', () => {
    for (const role of ['viewer', 'member', 'admin']) {
      expect(canCreate(experienceAuthorsSchema, role)).toBe(false)
      expect(canUpdate(experienceAuthorsSchema, role, record('me'), 'me', noopPermissionContext)).toBe(false)
      expect(canDelete(experienceAuthorsSchema, role, record('me'), 'me', noopPermissionContext)).toBe(false)
    }
  })

  it('one author row per experience', () => {
    expect(experienceAuthorsSchema.uniqueOn).toEqual(['experienceId'])
  })
})

describe('users', () => {
  it('members see only themselves in the user list', () => {
    expect(usersSchema.roster).toBe('read-policy')
    expect(canRead(usersSchema, 'member', record('other'), 'me', noopPermissionContext)).toBe(false)
  })
})
