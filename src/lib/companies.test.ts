import { describe, expect, it } from 'vitest'
import {
  displayHost,
  isDuplicateError,
  normalizeWebsite,
  safeExternalUrl,
  slugify,
  validateNewCompany,
} from './companies'

describe('slugify', () => {
  it('makes URL-friendly slugs', () => {
    expect(slugify('Example Technologies')).toBe('example-technologies')
    expect(slugify('  Example   Technologies, Inc. ')).toBe('example-technologies-inc')
    expect(slugify('Ben & Jerry’s')).toBe('ben-and-jerry-s')
    expect(slugify('Café Société')).toBe('cafe-societe')
    expect(slugify('!!!')).toBe('')
  })
})

describe('safeExternalUrl', () => {
  it('allows only http and https web addresses', () => {
    expect(safeExternalUrl('https://example.com')).toBe('https://example.com/')
    expect(safeExternalUrl('http://example.com/jobs')).toBe('http://example.com/jobs')
    expect(safeExternalUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeExternalUrl('JAVASCRIPT:alert(1)')).toBeUndefined()
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined()
    expect(safeExternalUrl('https://localhost')).toBeUndefined()
    expect(safeExternalUrl('not a url')).toBeUndefined()
    expect(safeExternalUrl(42)).toBeUndefined()
    expect(safeExternalUrl(`https://example.com/${'a'.repeat(300)}`)).toBeUndefined()
  })
})

describe('normalizeWebsite', () => {
  it('adds https:// and rejects other schemes', () => {
    expect(normalizeWebsite('example.com')).toBe('https://example.com/')
    expect(normalizeWebsite(' www.example.com/careers ')).toBe('https://www.example.com/careers')
    expect(normalizeWebsite('javascript:alert(1)')).toBeUndefined()
    expect(normalizeWebsite('')).toBeUndefined()
  })
})

describe('displayHost', () => {
  it('shows the bare host', () => {
    expect(displayHost('https://www.example.com/jobs')).toBe('example.com')
  })
})

describe('validateNewCompany', () => {
  it('tidies a valid company', () => {
    expect(
      validateNewCompany({ name: '  Example   Labs ', industry: 'technology', location: ' ', website: 'example.com' }),
    ).toEqual({
      ok: true,
      fields: { name: 'Example Labs', slug: 'example-labs', industry: 'technology', website: 'https://example.com/' },
    })
  })

  it('reports each problem', () => {
    const result = validateNewCompany({ name: 'x', industry: 'space', location: 'a'.repeat(101), website: 'javascript:x' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['industry', 'location', 'name', 'website'])
  })

  it('needs a letter or number for the slug', () => {
    const result = validateNewCompany({ name: '!!!', industry: 'other' })
    expect(result.ok).toBe(false)
  })
})

describe('isDuplicateError', () => {
  it('recognizes the server uniqueOn refusal', () => {
    expect(isDuplicateError(new Error('Duplicate: a record with slug=acme already exists in companies'))).toBe(true)
    expect(isDuplicateError(new Error('FIELD ERROR: verified'))).toBe(false)
  })
})
