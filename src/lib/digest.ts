/**
 * The daily comment digest's pure parts: which comments count, and the email
 * text. The run itself is in src/server/comment-digest.ts.
 */

import { isTrue } from './options'

export interface DigestComment {
  createdAt: string
  data: { experienceId: string; byAuthor?: unknown; deleted?: unknown }
}

/**
 * New comments per experience since the last run. Skips deleted comments and
 * the author's own ("Owner") comments, which they don't need telling about.
 */
export function countNewComments(comments: DigestComment[], since: string, until: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const c of comments) {
    if (!(c.createdAt > since && c.createdAt <= until)) continue
    if (isTrue(c.data.deleted) || isTrue(c.data.byAuthor)) continue
    counts.set(c.data.experienceId, (counts.get(c.data.experienceId) ?? 0) + 1)
  }
  return counts
}

export interface DigestPost {
  experienceId: string
  /** "Software Engineer at Acme", or a fallback when the post's details are missing. */
  title: string
  count: number
}

export interface DigestEmail {
  subject: string
  text: string
  html: string
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)

const plural = (n: number, word: string) => `${n} new ${word}${n === 1 ? '' : 's'}`

/** The email for one author. No comment text, so nothing awkward if forwarded. */
export function digestEmail(posts: DigestPost[], appUrl: string): DigestEmail {
  const total = posts.reduce((sum, p) => sum + p.count, 0)
  const settings = `${appUrl}/settings`
  const lines = posts.map((p) => ({ ...p, url: `${appUrl}/experiences/${encodeURIComponent(p.experienceId)}` }))

  const text = [
    `You have ${plural(total, 'comment')} on your JobJourney posts:`,
    '',
    ...lines.map((p) => `- ${p.title}: ${plural(p.count, 'comment')}\n  ${p.url}`),
    '',
    `You're getting this because you turned on comment summaries. Turn them off in Settings: ${settings}`,
  ].join('\n')

  const html = `<p>You have ${plural(total, 'comment')} on your JobJourney posts:</p>
<ul>
${lines.map((p) => `  <li><a href="${escapeHtml(p.url)}">${escapeHtml(p.title)}</a>: ${plural(p.count, 'comment')}</li>`).join('\n')}
</ul>
<p style="color:#666;font-size:12px">You're getting this because you turned on comment summaries. <a href="${escapeHtml(settings)}">Turn them off in Settings</a>.</p>`

  return { subject: `${plural(total, 'comment')} on your JobJourney posts`, text, html }
}
