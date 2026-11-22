/**
 * helpfulVotes — one per user per experience. See docs/JobJourney Data Design.md.
 *
 * Written only by the `toggleHelpful` action (as the voter), which also
 * recounts the experience's `helpfulCount`. `userId` must be the writer's
 * own id (`userBound`), and `uniqueOn` makes a second vote a server-side
 * "Duplicate" error, even from a forged request or a double click.
 * Members read only their own votes, so nobody can browse who voted for what.
 */

import type { CollectionSchema } from 'deepspace/schema'

export interface HelpfulVote {
  experienceId: string
  userId: string
}

const actionOnly = { create: false, update: false, delete: false } as const

export const helpfulVotesSchema: CollectionSchema = {
  name: 'helpfulVotes',
  columns: [
    { name: 'experienceId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
  ],
  uniqueOn: ['experienceId', 'userId'],
  permissions: {
    viewer: { read: false, ...actionOnly },
    member: { read: 'own', ...actionOnly },
    admin: { read: true, ...actionOnly },
  },
}
