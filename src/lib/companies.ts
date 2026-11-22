/**
 * Company helpers shared by the add-company form, the pages and the actions.
 */

import { INDUSTRIES, isOneOf, type Industry } from './options'

export const COMPANY_NAME_MAX = 100
export const COMPANY_LOCATION_MAX = 100
export const COMPANY_WEBSITE_MAX = 200

/** "Example Technologies, Inc." → "example-technologies-inc". Empty if nothing usable. */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, COMPANY_NAME_MAX)
    .replace(/-+$/g, '')
}

/**
 * Turn what someone typed into a website URL, or undefined if it isn't one.
 * Adds https:// when missing; only http and https are accepted.
 */
export function normalizeWebsite(input: string): string | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  return safeExternalUrl(withScheme)
}

/**
 * A stored website as a URL that is safe to put in an href, or undefined.
 * Members write `website` directly and the server doesn't validate URLs, so a
 * forged request could store `javascript:…`. Never render a stored URL
 * without passing it through this.
 */
export function safeExternalUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > COMPANY_WEBSITE_MAX) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
    if (!url.hostname.includes('.')) return undefined
    return url.href
  } catch {
    return undefined
  }
}

/** "https://www.example.com/jobs" → "example.com". */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export interface NewCompanyInput {
  name: string
  industry: string
  location?: string
  website?: string
}

export interface NewCompanyFields {
  name: string
  slug: string
  industry: Industry
  location?: string
  website?: string
}

export type NewCompanyResult =
  | { ok: true; fields: NewCompanyFields }
  | { ok: false; errors: Partial<Record<keyof NewCompanyInput, string>> }

/** Check and tidy the add-company form. The server enforces lengths and slug uniqueness too. */
export function validateNewCompany(input: NewCompanyInput): NewCompanyResult {
  const errors: Partial<Record<keyof NewCompanyInput, string>> = {}
  const name = input.name.trim().replace(/\s+/g, ' ')
  const slug = slugify(name)
  const location = input.location?.trim() || undefined
  const websiteText = input.website?.trim() ?? ''
  const website = normalizeWebsite(websiteText)

  if (name.length < 2) errors.name = 'Enter the company name.'
  else if (name.length > COMPANY_NAME_MAX) errors.name = `Use ${COMPANY_NAME_MAX} characters or fewer.`
  else if (!slug) errors.name = 'Use at least one letter or number.'

  if (!isOneOf(INDUSTRIES, input.industry)) errors.industry = 'Choose an industry.'

  if (location && location.length > COMPANY_LOCATION_MAX) {
    errors.location = `Use ${COMPANY_LOCATION_MAX} characters or fewer.`
  }

  if (websiteText && !website) errors.website = 'Enter a web address like example.com.'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    fields: {
      name,
      slug,
      industry: input.industry as Industry,
      ...(location ? { location } : {}),
      ...(website ? { website } : {}),
    },
  }
}

/** True when a write error is the server's uniqueOn refusal. */
export function isDuplicateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /^duplicate\b/i.test(message.trim())
}
