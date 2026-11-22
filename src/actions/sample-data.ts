/**
 * Loads clearly-labelled sample companies, positions and experiences, so the
 * pages have something to show. Admin only. Safe to run more than once:
 * existing companies (by slug), positions (by company + title + level) and
 * experiences (by their fixed sample ids) are skipped.
 *
 * Sample experiences are written like real ones — as the app owner, so
 * `createdBy` reveals nothing — but get no author row: nobody can edit them,
 * and admins can delete them.
 */

import type { ActionHandler, QueryActionData } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { Experience } from '../lib/experience'
import type { Category, Industry, Level } from '../lib/options'
import { createOwnerRecordTools } from '../server/record-tools'
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

type SampleExperience = Omit<Experience, 'companyId' | 'positionId' | 'helpfulCount' | 'commentCount'> & {
  /** Fixed record id, so re-running the seed skips it. */
  id: string
  companySlug: string
  positionTitle: string
}

/** Every outcome is covered. Each story starts "Sample post:" so it can't pass as a real review. */
export const SAMPLE_EXPERIENCES: SampleExperience[] = [
  {
    id: 'sample-exp-01', companySlug: 'example-technologies', positionTitle: 'Software Engineer Intern',
    isAnonymous: 1, appliedMonth: '2026-02', workArrangement: 'hybrid', firstResponseDays: 9, noResponse: 0,
    interviewStages: 3, interviewFormats: ['phone_screen', 'technical', 'final_round'], outcome: 'offer',
    interviewExperience: 'Sample post: a recruiter call, a 60-minute coding round on arrays and hash maps, then a final round with two engineers.',
    advice: 'Talk through your approach before writing code. They cared more about reasoning than speed.',
  },
  {
    id: 'sample-exp-02', companySlug: 'example-technologies', positionTitle: 'Software Engineer Intern',
    isAnonymous: 1, appliedMonth: '2026-03', workArrangement: 'hybrid', firstResponseDays: 21, noResponse: 0,
    interviewStages: 2, interviewFormats: ['online_assessment', 'technical'], outcome: 'rejected',
    interviewExperience: 'Sample post: an online assessment with two problems, then one technical interview.',
    advice: 'The assessment is timed tightly. Practice medium problems with a timer.',
  },
  {
    id: 'sample-exp-03', companySlug: 'example-technologies', positionTitle: 'Junior Data Analyst',
    isAnonymous: 1, appliedMonth: '2026-05', workArrangement: 'remote', noResponse: 1,
    interviewStages: 0, interviewFormats: [], outcome: 'ghosted',
    advice: 'Sample post: applied through the careers page and never heard back. Reach out to a recruiter directly.',
  },
  {
    id: 'sample-exp-04', companySlug: 'sample-financial-group', positionTitle: 'Cybersecurity Analyst Intern',
    isAnonymous: 1, appliedMonth: '2026-01', workArrangement: 'on_site', firstResponseDays: 5, noResponse: 0,
    interviewStages: 2, interviewFormats: ['behavioral', 'technical'], outcome: 'offer',
    interviewExperience: 'Sample post: a behavioral round, then a technical round on networking basics and incident response.',
    advice: 'Review the OSI model and be ready to walk through how you would investigate a phishing email.',
  },
  {
    id: 'sample-exp-05', companySlug: 'sample-financial-group', positionTitle: 'Software Engineer',
    isAnonymous: 1, appliedMonth: '2026-06', workArrangement: 'hybrid', firstResponseDays: 14, noResponse: 0,
    interviewStages: 4, interviewFormats: ['phone_screen', 'take_home', 'technical', 'final_round'], outcome: 'withdrew',
    interviewExperience: 'Sample post: a phone screen, a take-home project, a review of the project, then a final round. I accepted another offer before the final round.',
  },
  {
    id: 'sample-exp-06', companySlug: 'demo-health-systems', positionTitle: 'Data Analyst',
    isAnonymous: 1, appliedMonth: '2026-08', workArrangement: 'on_site', firstResponseDays: 3, noResponse: 0,
    interviewStages: 2, interviewFormats: ['phone_screen', 'behavioral'], outcome: 'in_progress',
    interviewExperience: 'Sample post: a short phone screen, then a behavioral interview with the team lead. Waiting on next steps.',
    advice: 'Have one story ready about cleaning messy data.',
  },
  {
    id: 'sample-exp-07', companySlug: 'demo-health-systems', positionTitle: 'Help Desk Technician',
    isAnonymous: 1, appliedMonth: '2026-04', workArrangement: 'on_site', firstResponseDays: 7, noResponse: 0,
    interviewStages: 1, interviewFormats: ['behavioral'], outcome: 'rejected',
    advice: 'Sample post: they asked a lot about customer service. Give concrete examples of calming down a frustrated user.',
  },
  {
    id: 'sample-exp-08', companySlug: 'placeholder-city-government', positionTitle: 'IT Intern',
    isAnonymous: 1, appliedMonth: '2026-02', workArrangement: 'on_site', firstResponseDays: 30, noResponse: 0,
    interviewStages: 1, interviewFormats: ['behavioral'], outcome: 'offer',
    interviewExperience: 'Sample post: one panel interview with three people. The process was slow but friendly.',
    advice: 'Government hiring takes a while. Apply early and be patient.',
  },
  {
    id: 'sample-exp-09', companySlug: 'placeholder-city-government', positionTitle: 'Security Engineer',
    isAnonymous: 1, appliedMonth: '2026-07', workArrangement: 'hybrid', noResponse: 1,
    interviewStages: 0, interviewFormats: [], outcome: 'ghosted',
    interviewExperience: 'Sample post: applied online, no response after two months.',
  },
  {
    id: 'sample-exp-10', companySlug: 'example-nonprofit-network', positionTitle: 'Web Developer',
    isAnonymous: 1, appliedMonth: '2026-09', workArrangement: 'remote', firstResponseDays: 2, noResponse: 0,
    interviewStages: 3, interviewFormats: ['phone_screen', 'take_home', 'final_round'], outcome: 'in_progress',
    interviewExperience: 'Sample post: a quick phone screen and a small take-home building an accessible form.',
    advice: 'They value accessibility. Use labels, keyboard support and good contrast in the take-home.',
  },
]

const isDuplicate = (error: string) => /^duplicate\b/i.test(error.trim())

export const seedSampleData: ActionHandler<Env> = async ({ userId, tools, env }) => {
  const denied = await requireAdmin(env, userId)
  if (denied) return denied
  const owner = createOwnerRecordTools(env)
  if (!owner) return refuse("Sample data isn't available right now: the app owner isn't configured.")

  let companiesCreated = 0
  let companiesUpdated = 0
  let positionsCreated = 0
  let experiencesCreated = 0
  /** "slug|title" → { companyId, positionId } */
  const positionIds = new Map<string, { companyId: string; positionId: string }>

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

    // Look the positions up again to learn their ids (new or pre-existing).
    const listed = (await tools.query('positions', { where: { companyId }, limit: 100 })) as
      | { success: true; data: QueryActionData<{ title?: string }> }
      | { success: false; error: string }
    if (!listed.success) return refuse(`Couldn't list positions at ${sample.name}: ${listed.error}`)
    for (const record of listed.data.records) {
      if (record.data.title) {
        positionIds.set(`${sample.slug}|${record.data.title}`, { companyId, positionId: record.recordId })
      }
    }
  }

  for (const sample of SAMPLE_EXPERIENCES) {
    const ids = positionIds.get(`${sample.companySlug}|${sample.positionTitle}`)
    if (!ids) continue // its position was removed by an admin; skip rather than fail
    const existing = await owner.get('experiences', sample.id)
    if (existing.success) continue
    const { id, companySlug: _slug, positionTitle: _title, ...fields } = sample
    const created = await owner.create(
      'experiences',
      { ...fields, ...ids, helpfulCount: 0, commentCount: 0 },
      id,
    )
    if (!created.success) return refuse(`Couldn't add a sample experience: ${created.error}`)
    experiencesCreated += 1
  }

  console.info(
    `[action] seedSampleData companies=${companiesCreated} updated=${companiesUpdated} positions=${positionsCreated} experiences=${experiencesCreated} by=${userId}`,
  )
  return {
    success: true,
    data: { companiesCreated, companiesUpdated, positionsCreated, experiencesCreated },
  }
}
