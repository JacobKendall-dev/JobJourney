/**
 * Loads clearly-labelled sample companies and positions, so the pages have
 * something to show. Admin only. Safe to run more than once: existing
 * companies (by slug) and positions (by company + title + level) are skipped.
 *
 * Sample experiences are added with createExperience, because they must be
 * written the same way real ones are (as the app owner, with an author row).
 */

import type { ActionHandler, QueryActionData } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { Category, Industry, Level } from '../lib/options'
import { refuse, requireAdmin } from './guards'

interface SampleCompany {
  name: string
  slug: string
  industry: Industry
  location: string
  website: string
  verified: boolean
  positions: { title: string; level: Level; category: Category }[]
}

/** Every name says Example / Sample / Demo / Placeholder, so nobody mistakes it for a real employer. */
export const SAMPLE_COMPANIES: SampleCompany[] = [
  {
    name: 'Example Technologies',
    slug: 'example-technologies',
    industry: 'technology',
    location: 'Austin, TX',
    website: 'https://example.com',
    verified: true,
    positions: [
      { title: 'Software Engineer Intern', level: 'intern', category: 'software' },
      { title: 'Junior Data Analyst', level: 'entry', category: 'data' },
      { title: 'IT Support Specialist', level: 'entry', category: 'it' },
    ],
  },
  {
    name: 'Sample Financial Group',
    slug: 'sample-financial-group',
    industry: 'finance',
    location: 'New York, NY',
    website: 'https://example.org',
    verified: true,
    positions: [
      { title: 'Cybersecurity Analyst Intern', level: 'intern', category: 'cybersecurity' },
      { title: 'Software Engineer', level: 'mid', category: 'software' },
    ],
  },
  {
    name: 'Demo Health Systems',
    slug: 'demo-health-systems',
    industry: 'healthcare',
    location: 'Columbus, OH',
    website: 'https://example.net',
    verified: false,
    positions: [
      { title: 'Data Analyst', level: 'entry', category: 'data' },
      { title: 'Help Desk Technician', level: 'entry', category: 'it' },
    ],
  },
  {
    name: 'Placeholder City Government',
    slug: 'placeholder-city-government',
    industry: 'government',
    location: 'Springfield, IL',
    website: 'https://example.com',
    verified: false,
    positions: [
      { title: 'IT Intern', level: 'intern', category: 'it' },
      { title: 'Security Engineer', level: 'mid', category: 'cybersecurity' },
    ],
  },
  {
    name: 'Example Nonprofit Network',
    slug: 'example-nonprofit-network',
    industry: 'other',
    location: 'Remote',
    website: 'https://example.org',
    verified: false,
    positions: [
      { title: 'Data Intern', level: 'intern', category: 'data' },
      { title: 'Web Developer', level: 'entry', category: 'software' },
    ],
  },
]

const isDuplicate = (error: string) => /^duplicate\b/i.test(error.trim())

export const seedSampleData: ActionHandler<Env> = async ({ userId, tools, env }) => {
  const denied = await requireAdmin(env, userId)
  if (denied) return denied

  let companiesCreated = 0
  let companiesUpdated = 0
  let positionsCreated = 0

  for (const sample of SAMPLE_COMPANIES) {
    const found = (await tools.query('companies', { where: { slug: sample.slug }, limit: 1 })) as
      | { success: true; data: QueryActionData<{ location?: string }> }
      | { success: false; error: string }
    if (!found.success) return refuse(`Couldn't check for ${sample.name}: ${found.error}`)

    const existing = found.data.records[0]
    let companyId = existing?.recordId
    if (existing && existing.data.location !== sample.location) {
      // Earlier sample data used Remote / Hybrid / On-site as the company
      // location; it's now the headquarters city. Bring old samples up to date.
      const updated = await tools.update('companies', existing.recordId, { location: sample.location })
      if (!updated.success) return refuse(`Couldn't update ${sample.name}: ${updated.error}`)
      companiesUpdated += 1
    }
    if (!companyId) {
      const created = await tools.create('companies', {
        name: sample.name,
        slug: sample.slug,
        industry: sample.industry,
        location: sample.location,
        website: sample.website,
        verified: sample.verified,
        ...(sample.verified ? { verifiedBy: userId } : {}),
      })
      if (!created.success) return refuse(`Couldn't add ${sample.name}: ${created.error}`)
      companyId = created.data.recordId
      companiesCreated += 1
    }

    for (const position of sample.positions) {
      const created = await tools.create('positions', { companyId, ...position })
      if (created.success) positionsCreated += 1
      else if (!isDuplicate(created.error)) {
        return refuse(`Couldn't add ${position.title} at ${sample.name}: ${created.error}`)
      }
    }
  }

  console.info(
    `[action] seedSampleData created=${companiesCreated} updated=${companiesUpdated} positions=${positionsCreated} by=${userId}`,
  )
  return { success: true, data: { companiesCreated, companiesUpdated, positionsCreated } }
}
