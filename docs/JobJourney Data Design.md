# CareerTrail Data Design

Nov 21, 2026 · @bocaj · revised after the DeepSpace review (SDK 0.44.2)

## Overview and key decisions

CareerTrail's data model: the **collections** (tables), their fields, who can do what, and the **actions** (custom backend functions). It has been checked against DeepSpace's schema format, permissions and action tools as installed in this project. The answers are in "Answers from the review" below.

**Key decisions**

1. **Experiences are the centerpiece.** Companies and positions exist mainly to organize and filter them.
2. **Anonymous by default.** Posting requires an account, but the author's name is hidden unless they choose to show it.
3. **Anonymity has to be real, not just hidden in the UI.** Realtime sync sends whole records to every browser in the room, and DeepSpace stamps every record with `createdBy`, the user who wrote it. Readers receive that field too, even when the write comes from an action. So:
   - The public `experiences` record **never stores who wrote it**. No author field exists, and every experience is written **as the app owner** (`env.OWNER_USER_ID`), so `createdBy` is the same owner ID on every post.
   - Authorship lives in a separate **private** collection, `experienceAuthors`. That row is written as the real author, so its `createdBy` *is* the author, and **only the author can read it**. Admins can't read other people's rows either.
   - Creating, editing and deleting experiences goes through **actions** that check `experienceAuthors`.
   - DeepSpace can't hide individual fields from readers; permissions apply to whole records. So the separate collection is required.
4. **One helpful vote per user per experience**, enforced by the database (`uniqueOn`), not just by disabling a button.
5. **Comments show the commenter's name** in v1 (no anonymous comments). That keeps the model simpler. It's a tradeoff to mention in the write-up.
6. **Must-have vs. stretch.** Must: companies, positions, experiences, comments, helpful votes, bookmarks. Stretch: company discussions, notifications.
7. **Use schema rules wherever they can do the job, and actions only where they can't.** `writableFields`, `uniqueOn`, `userBound`, `default`, `maxLength` and `timestampTrigger` are enforced on the server for every write. They replace two actions the first draft planned.

## Changes after review

| What changed | Why |
| --- | --- |
| Experiences are written as the app owner, not as the caller. Actions get a second, owner-identity set of tools for this. | An action's tools act as the caller, and the SDK saves that caller as `createdBy` on the record and sends it to every reader. Without this change, every anonymous post would reveal its author in DevTools. |
| `experienceAuthors` drops `authorId`. The author is the row's built-in `createdBy`. | The row is written as the author, so `createdBy` already holds the author, and `read: 'own'` checks it with no extra setup. |
| The `users` schema gets `roster: 'read-policy'`. | Otherwise every member can see every other member's `lastSeenAt` and could match a post's time to who was online. |
| Removed `createdBy` on companies and positions, `updatedAt` on experiences, and `authorId` and `editedAt` on comments. | DeepSpace adds `recordId`, `createdBy`, `createdAt` and `updatedAt` to every record. "Edited" is shown when a comment's `updatedAt` is later than its `createdAt`. |
| Removed the `createCompany` action. Companies use `writableFields`, `default: false` on `verified`, and `uniqueOn: ['slug']`. | The server rejects any member write that touches `verified`, on create and on update. The slug rule blocks duplicates, so the action had nothing left to check. |
| `setCompanyVerified` stays only so `verifiedBy` is set by the server. `verifiedAt` comes from `timestampTrigger`. | Admins could edit `verified` directly, but the action records which admin did it and can't be faked. |
| Comments: creating is **action only** (`postComment`). Members can edit only `body` and `deleted` on their own comment, and soft delete clears `body`. | The first draft's table said "member create", which contradicted `postComment`. The action sets `authorName` from the user's real name. Otherwise anyone could post under any name. Clearing `body` stops deleted text from still reaching every browser. |
| `helpfulVotes` and `bookmarks` use `uniqueOn` with a `userBound` `userId`. Bookmarks need no action. | The server stamps the caller's ID and rejects a second vote or bookmark, even from a forged request or a double-click. |
| `toggleHelpful` and `postComment` **recount** instead of adding 1. | DeepSpace has no atomic increment. A recount corrects itself, while adding 1 can lose a vote when two arrive at once. |
| Text limits use `maxLength` on columns. Choice fields use `select`. `interviewFormats` uses `json`. | `maxLength` is enforced before every write, action writes included. A `json` list reads back as a real array. |
| Filters: industry, interview format and text search run in the browser. | Queries support only exact-match `where`, one `orderBy` and a `limit`. There is no "contains", no range filter and no text search. |
| Every role that reads public data is listed, `viewer` included. | Visitors who aren't signed in connect as `viewer`, so that role needs `read: true` on public collections. |
| The stretch goal "discussions" gets its own `discussionReplies` collection. | `comments.experienceId` is required, so discussion replies can't reuse `comments`. |
| Agent tools become read-only. | They follow your permission rules, but they can still create, update and delete anything the user can. Read-only removes the prompt-injection risk of a post telling an agent to delete things. |
| `.gitignore` adds `.env`, `.env.*` and `.claude/settings.local.json`. Added GitHub-source rules. | `.dev.vars` was covered, but `.env` files weren't. Under GitHub source, a deploy ships the working tree exactly as it is. |

**Second round, after the page map review**

| What changed | Why |
| --- | --- |
| Admins lose read access to other people's `experienceAuthors` rows; they get `read: 'own'` like members. | Moderators can delete posts without knowing who wrote them, and it keeps "Only you can see this list" on My posts true for every user. |
| Added `noResponse` (boolean) to experiences. | The share form offers "No response yet". Without a flag, an empty `firstResponseDays` can't tell "no response yet" apart from "didn't say". |
| `companyId` and `positionId` on experiences are `immutable`. | The edit page doesn't let them change; now the server refuses it too. |
| `updateExperience` sets `authorName` from the user's account. | The edit page can switch between anonymous and named, and the name must never come from the browser. |
| Added a `deleteCompany` action; admins can no longer delete companies directly. | A company deleted while it has experiences would leave posts pointing at nothing. The action refuses in that case and removes the company's positions otherwise. |
| The app owner caveat is added to the remaining risks. | People who control the app's code can still read authorship server-side; the privacy promise is about other users. |
| Browse loads all experiences and filters and pages in the browser. | In the browser, `useQuery` has no `offset` and no total count, so paging on the server can't give a correct count or work with browser filters. |

## How the collections connect

&#91;embedded content: CareerTrail collections and how they connect\]

A company has positions. Each experience belongs to a company and a position, and gets comments, helpful votes and bookmarks. Who wrote an experience lives only in the private `experienceAuthors` collection. Stretch goals (company discussions, notifications) would hang off companies and users.

## Collections and fields

Format: `field` (type): note.

**Every record automatically has** `recordId`, `createdBy` (who wrote it), `createdAt` and `updatedAt`, so none of these are listed below. Your own fields are under `record.data`. `createdBy` is sent to everyone who can read the record.

Column options used below:
- `required`, `default`.
- `maxLength`: text limit, checked before every write.
- `userBound`: the server fills the field with the caller's verified ID on create and keeps it on update.
- `immutable`: the field can't change after it's created.
- `timestampTrigger`: the server sets the time when another field changes.

Two storage facts to remember (checked in SDK 0.44.2):
- **`select` options aren't enforced.** The server stores any text. Actions validate the choices they write. For fields members write directly (company industry, position level and category), the UI shows unknown values as "Other".
- **Booleans read back as `0` / `1`**, not `true` / `false`. Never compare a stored boolean with `=== true`; use a helper (`isTrue` in `src/lib/options.ts`).

### companies

- `name` (text, required, `maxLength` 100): "Example Technologies"
- `slug` (text, required, `maxLength` 100): URL-friendly name, `example-technologies`, used in `/companies/example-technologies`. **`uniqueOn: ['slug']`**.
- `industry` (`select`): technology, finance, healthcare, government, other
- `location` (text, optional)
- `website` (`url`, optional)
- `verified` (`boolean`, **`default: false`**): shows a "Verified" badge so viewers know the company is real. **Only an admin can change it.** Members can't write it, because it's left out of their `writableFields`. New companies always start unverified, and the default doesn't count as a member write.
- `verifiedBy` (user id, optional): set by `setCompanyVerified`
- `verifiedAt` (time, optional): `timestampTrigger: { field: 'verified', value: true }`, so the server stamps it when `verified` becomes true

### positions

- `companyId` (company id, required)
- `title` (text, required, `maxLength` 100): "Software Engineer Intern"
- `level` (`select`): intern, entry, mid, senior
- `category` (`select`): software, IT, cybersecurity, data, other
- **`uniqueOn: ['companyId', 'title', 'level']`** prevents duplicate positions

### experiences (public, no author id)

Written **only** by actions, and **always as the app owner**, so `createdBy` is the owner on every experience.

- `companyId`, `positionId` (required, `immutable`): an edit can't move a post to another company or position
- `isAnonymous` (`boolean`, **default true**)
- `authorName` (text, optional): filled **only** when the author chooses to show their name. A copy of the name, not a link to the user.
- `appliedMonth` (text, `2026-09`): month only, not the exact day, so posts are harder to trace back to a person
- `firstResponseDays` (number, optional): empty when the author didn't say, or when `noResponse` is true
- `noResponse` (`boolean`, `default: false`): true means "no response yet". `firstResponseDays` must then be empty.
- `interviewStages` (number, 0–10)
- `interviewFormats` (`json`, a list of choices): phone screen, online assessment, technical, behavioral, take-home, final round. Stored as `json` so it reads back as an array; actions check every entry against this list.
- `outcome` (`select`): offer, rejected, ghosted, withdrew, in progress
- `interviewExperience` (long text, `maxLength` 2000)
- `advice` (long text, `maxLength` 2000)
- `helpfulCount`, `commentCount` (number storage, `default: 0`): set only by actions, by recounting. Number storage is needed so "most helpful" sorts correctly.

### experienceAuthors (private)

Written by actions **as the author**, so this row's built-in `createdBy` is the author.

- `experienceId` (required, `immutable`). **`uniqueOn: ['experienceId']`**: one author row per experience.

### comments

Created only by `postComment`, as the commenter, so `createdBy` is the commenter.

- `experienceId` (required, `immutable`)
- `parentId` (comment id, optional, `immutable`): empty = top-level comment. Set = a reply. Replies go one level deep only.
- `authorName` (text): copied from the commenter's `users` row by the action. Visitors who aren't signed in get no user directory, so this copy is what they see.
- `body` (text, required, `maxLength` 1000)
- `deleted` (`boolean`, `default: false`): a deleted comment shows "\[deleted\]" so its replies still make sense. Soft delete also sets `body` to `""`.
- "Edited" label: show it when `updatedAt` is later than `createdAt`. No separate field is needed.

### helpfulVotes

- `experienceId` (required, `immutable`)
- `userId` (`userBound`, `immutable`): the server stamps the voter's ID
- **`uniqueOn: ['experienceId', 'userId']`**: one vote per user per experience, enforced by the server

### bookmarks

- `experienceId` (required, `immutable`)
- `userId` (`userBound`, `immutable`)
- **`uniqueOn: ['experienceId', 'userId']`**

### users (scaffold, one change)

- Keep the scaffold's schema. Add **`roster: 'read-policy'`**. Members then see only themselves in the user list, instead of every member's name and `lastSeenAt`. Admins still see everyone. Comments don't depend on the user list, because they store `authorName`.

### Stretch goals

- **discussions**: `companyId`, optional `positionId`, `title`, `body`, `replyCount`. The author is `createdBy`; discussions are not anonymous.
- **discussionReplies**: `discussionId`, `body`, `authorName`, `deleted`. Same rules as comments.
- **notifications**: `userId` (recipient), `type` (reply, comment on your experience), `link`, `read`. Created by actions; recipients can read their own and update only `read`.

## Permission rules

Who:
- **viewer** = not signed in. Visitors connect with this role (`allowAnonymous`), so it needs `read: true` on public collections.
- **member** = any signed-in user.
- **own** = the record's `createdBy` (or its `ownerField`) is the caller.
- **admin** = you.

"Action only" means `create`/`update`/`delete: false` for every role. The change has to go through a server action that runs its own checks.

| Collection | Read | Create | Update | Delete |
| --- | --- | --- | --- | --- |
| companies | everyone | member, `writableFields: name, slug, industry, location, website` | admin (incl. `verified`) | action only (`deleteCompany`) |
| positions | everyone | member, `writableFields: companyId, title, level, category` | admin | admin |
| experiences | everyone | action only | action only (author) | action only (author or admin) |
| experienceAuthors | member and admin: `own` only | action only | nobody | action only |
| comments | everyone | action only (`postComment`) | member: `own`, `writableFields: body, deleted`. admin: all | admin (the `deleteExperience` cascade) |
| helpfulVotes | member: `own`. admin: all | action only | nobody | action only |
| bookmarks | member: `own` | member | nobody | member: `own` |
| users | scaffold rules (`own`, admin all), plus `roster: 'read-policy'` |  |  |  |
| settings | unchanged from the scaffold (admin only) |  |  |  |

Example in this project's format:

```ts
// companies
permissions: {
  viewer: { read: true, create: false, update: false, delete: false },
  member: { read: true, create: true, update: false, delete: false,
            writableFields: ['name', 'slug', 'industry', 'location', 'website'] },
  admin:  { read: true, create: true, update: true, delete: false }, // delete via deleteCompany
},
uniqueOn: ['slug'],

// experienceAuthors: nobody, admins included, reads another person's row
permissions: {
  viewer: { read: false, create: false, update: false, delete: false },
  member: { read: 'own', create: false, update: false, delete: false },
  admin:  { read: 'own', create: false, update: false, delete: false },
},
uniqueOn: ['experienceId'],

// bookmarks
permissions: {
  viewer: { read: false, create: false, update: false, delete: false },
  member: { read: 'own', create: true, update: false, delete: 'own' },
  admin:  { read: true, create: false, update: false, delete: true },
},
uniqueOn: ['experienceId', 'userId'],
```

**Why some of these choices**

- **Experiences are action-only** because the author check depends on the private `experienceAuthors` collection, every write must be done as the owner to keep `createdBy` anonymous, and users must not be able to set `helpfulCount`.
- **Authorship is readable only by the author.** Admins moderate with `deleteExperience` and never need to know who wrote a post. Queries for "my posts" should still include `where: { createdBy: user.id }` so the intent is explicit.
- **Companies are deleted only through `deleteCompany`**, so a company with experiences can't disappear from under them.
- **Votes are readable only by the voter.** Pages show `helpfulCount`, and nobody can browse who voted for what.
- **Members can add companies and positions** so the site isn't limited to what you seed. `uniqueOn` prevents duplicates, `writableFields` keeps `verified` out of their reach, and admins can clean up. Nothing checks that a position's `companyId` exists, so admins should watch for stray positions.
- **Test every row with two accounts and while signed out** in `npm test`. That's the multi-user verification DeepSpace looks for.

## Actions

Remember: **record permissions are OFF inside actions** (`X-App-Action: 'true'`). Each check below has to be written into the action itself. When Claude Code writes one, confirm the check is there.

**Two identities.** An action's normal `tools` act as the caller, so anything it creates has `createdBy` = caller. Experiences need a second set of tools that act as `env.OWNER_USER_ID`, which is the same pattern `src/server/realtime-routes.ts` uses. That set must be added to `src/server/action-routes.ts`, for example as `ownerTools` next to `tools`. Use it for **every** write to `experiences`, and the normal `tools` for everything else.

**Admin checks** use `resolveAppRole(env, userId) === 'admin'` (from `deepspace/worker`, the same check `worker.ts` uses for jobs). Never trust a role sent from the browser.

| Action | What it does | Checks it must make |
| --- | --- | --- |
| `createExperience` | Creates the public experience **with the owner tools**, then its `experienceAuthors` row **with the caller tools**. Sets `authorName` only if the user chose to show it, from their `users` row. | Signed in. Company and position exist, and the position belongs to the company. Fields pass validation (below). Never copy the user ID onto the experience. If creating the author row fails, delete the experience. |
| `updateExperience` | Edits an experience's details, with the owner tools. Sets `authorName` from the user's `users` row when "Show my name" is on, and clears it when it's off. | An `experienceAuthors` row exists with this `experienceId` and `createdBy` = this user. Only accepts content fields and the anonymity choice, never `companyId`, `positionId`, `helpfulCount`, `commentCount` or `authorName` sent from the browser. Fields pass validation. |
| `deleteExperience` | Deletes the experience (owner tools), then its author row, votes, bookmarks and comments with `deleteWhere({ experienceId })`. Repeats each until fewer than the limit are deleted. | The user is the author **or** an admin. Every `deleteWhere` must be scoped to this `experienceId`. |
| `toggleHelpful` | Looks for this user's vote. Removes it if found, creates one if not. Then **recounts** the experience's votes and writes `helpfulCount`. | Signed in. Experience exists. The user isn't its author (check `experienceAuthors`). A "Duplicate" error from `uniqueOn` means a vote already exists, so treat it as success. Recounting must page through results (`offset`/`nextOffset`), because a query returns 50 records by default. |
| `postComment` | Creates the comment as the caller, with `authorName` from their `users` row. Then **recounts** `commentCount`. Later: creates a notification. | Signed in. Experience exists. `body` is 1–1,000 characters. If `parentId` is set, that comment exists, belongs to the same experience and has no `parentId` itself (no reply chains). |
| `setCompanyVerified` | Sets `verified` to true or false and sets `verifiedBy` to the admin's ID. `verifiedAt` is stamped by `timestampTrigger`. | The user is an admin (`resolveAppRole`). |
| `deleteCompany` | Deletes a company and its positions (`deleteWhere({ companyId })`). | The user is an admin. **Refuses** if any experience has this `companyId` (query with `limit: 1`), and says how to resolve it: delete or move those experiences first. |

Not actions (handled by permission rules): creating a company or position, editing or soft-deleting your own comment (the UI sets `deleted: true` and `body: ""` together), and bookmarks.

`commentCount` counts every comment, deleted placeholders included, because soft delete doesn't go through an action.

**Counters.** Two votes at the same moment can leave `helpfulCount` briefly wrong; the next vote fixes it. If exact counts matter, add a nightly recount in `src/cron.ts`.

**Good tradeoff to mention in your write-up:** anonymity is enforced in the data model, not just hidden in the UI. Realtime sync sends records, including `createdBy`, to every browser, so experiences are written under the app's identity and authorship lives in a private collection.

## Validation, search and seed data

**Enforced by the schema** (on every write, actions included): required fields, text limits (`maxLength`: experience and advice 2,000 each, comments 1,000), one vote and bookmark per user, unique slugs and positions, and members can't touch `verified`.

**Checked in actions** (the schema can't express these):

- Required: company, position, outcome, and at least one of interview experience or advice
- `interviewStages` 0–10. `firstResponseDays` 0–365.
- `noResponse` and `firstResponseDays` can't both be set
- `appliedMonth` matches `YYYY-MM` and isn't in the future
- Choice fields, including each entry in `interviewFormats`, only accept the listed options

**Search and filters** on the experiences page. Queries support exact-match `where`, one `orderBy` (with `orderDir`) and `limit`. There is no "contains", no range filter and no text search. In the browser, `useQuery` also has no `offset` and no total count. So Browse subscribes to **all** experiences once and does filtering, counting and "Load more" in the browser. That's fine at this size, the list stays live, and it's safe, because records a user can't read are never sent to them.

| Filter | How |
| --- | --- |
| Company, position, outcome | Match `companyId`, `positionId`, `outcome` (the URL holds the company slug; look up its ID) |
| Applied month | Match `appliedMonth` |
| Industry | Load companies, keep those in the industry, then filter experiences by `companyId` |
| Interview format | `interviewFormats.includes(choice)` |
| Text (`q`) | Match company and position names |
| Sort | Newest (`createdAt`) or most helpful (`helpfulCount`) |

**Seed data:** 4–5 companies, 2–3 positions each, and about 10 experiences covering every outcome, so the filters have something to show. Mark them clearly as sample data (e.g., "Example Technologies"). Real-looking fake reviews would mislead users. Seed experiences are written as the owner like any other experience.

## Security and AI risks

Checked against [Cycode's 11 AI security vulnerabilities](https://cycode.com/blog/ai-security-vulnerabilities/) and [IBM's 10 AI dangers](https://www.ibm.com/think/insights/10-ai-dangers-and-risks-and-how-to-manage-them). CareerTrail has no AI features for its users (in-app AI chat is off), so most model-level risks don't apply. The real exposure comes from three places: **the coding agent writing your code**, **the agent tools the scaffold already exposes**, and **content users post**.

| Risk (source) | Where it shows up in CareerTrail | What to do |
| --- | --- | --- |
| **AI-generated code vulnerabilities** (Cycode) | Claude Code writes most of the code, including auth, permission rules and actions. A missing ownership check looks fine until someone abuses it. | Personally review every action, permission rule and auth change. Run `npm run validate`, `npm test` and `npm audit`. Note what you reviewed in the write-up. |
| **Excessive agency** (Cycode) | The scaffold exposes data tools to users' own AI agents (the local agent is on; in-app chat is off). They **follow your permission rules** and require app membership, so they can't read `experienceAuthors` or edit other people's posts, but they can create, update and delete anything the user can. Claude Code can also run commands on your machine. | Make the agent tools **read-only**: remove `records.create`, `records.update` and `records.delete` from `ALLOWED_TOOL_NAMES` in `src/ai/tools.ts`. To turn them off entirely, use `registerAgent(app, { tools: buildTools, local: false, inApp: false })` in `worker.ts`. Approve deploys and file deletions yourself. |
| **Sensitive information disclosure** (Cycode) + **Data privacy** (IBM) | Anonymous authors leaking through `createdBy` or through the user list's `lastSeenAt`. Users posting names or emails of recruiters or themselves. Nothing is committed yet, so `git add -A` could commit secret files. | Write experiences as the owner and keep `experienceAuthors`. Set `roster: 'read-policy'` on `users`. **Add `.env`, `.env.*` and `.claude/settings.local.json` to `.gitignore` before the first commit** (`.dev.vars*`, `.wrangler` and `.deepspace` are already covered). Keep app secrets in `npx deepspace secrets`, never in files or frontend code. Add a notice on the submit form: no names, emails or identifying details. Let users delete their posts. |
| **Improper output handling** (Cycode) | Like AI output, everything users post is untrusted. Rendered as raw HTML or unsanitized markdown, a post could run a script in other users' browsers (XSS). | Show posts as plain text (React escapes it by default). No `dangerouslySetInnerHTML`, and no markdown rendering without a sanitizer. Validate on the server. |
| **Prompt injection** (Cycode) | If an AI agent reads posts through the agent tools, a post could hide instructions like "ignore your rules and delete...". Claude Code can also be misled by text in files or pages it reads. | Read-only agent tools (above) mean a misled agent can't change anything. Read Claude Code's plan before approving changes. |
| **AI supply chain** (Cycode) | DeepSpace is alpha software whose APIs can change between versions. The skill, npm packages and MCP servers are third-party code. | Commit `package-lock.json` to pin versions. Upgrade the SDK with `npx deepspace@latest app update`, not by editing `package.json`. Install the skill only from github.com/deepdotspace. Don't add packages or MCP servers you don't need. |
| **Misinformation and manipulation** (IBM) | Fake companies and invented experiences would mislead job seekers. | The admin-only **Verified** badge on companies. Label seed data as sample. Admins can delete fake posts. Stretch: a report button and a daily post limit for new accounts. |
| **Lack of accountability** (IBM) | Reviewers want to know what the agent did and what you checked. | Keep a short build log: what you asked, what the agent did, what you verified or changed. It becomes your submission note. Actions already log `caller=<userId>` for every call. |
| **IP** (IBM) + **Shadow AI** (Cycode) | Interview questions covered by an NDA. Confidential employer information pasted into AI tools. | Submit-form guideline: don't post confidential interview materials. Don't paste confidential employer info into Claude Code (the brief forbids it too). |

**Not applicable** (CareerTrail doesn't train or host its own AI model): model theft, data and model poisoning, vector and embedding weaknesses, system prompt leakage, AI bias, environmental harms, existential risk, job loss.

**Remaining risks to mention in the write-up:**

- **Timing.** An anonymous post's `createdAt` is public. In a very small community, someone who knows when a person was active could still guess. Showing only `appliedMonth` and hiding the user list reduces this but doesn't remove it.
- **The app owner.** "Only you can see this list" is true for every *user* of the app, admins included. But anyone who controls the app's server code (the app owner and any collaborators who can deploy) can read `experienceAuthors`, because server actions run with permissions off. The DeepSpace platform also stores that data. The promise protects authors from other users, not from the people who run the app. Don't add code that reads or logs authorship for any other purpose.

**Security checklist before submitting**

- [ ] `.gitignore` includes `.env`, `.env.*` and `.claude/settings.local.json` **before** the first commit
- [ ] Every action reviewed for its ownership/admin check, and every `deleteWhere` scoped to one experience
- [ ] Two-account and signed-out tests pass for every permission rule
- [ ] On an anonymous experience, the browser's network and WebSocket data contain no author ID. **`createdBy` equals the app owner's ID**, not the author's (check DevTools).
- [ ] A second member can't see the first member's `lastSeenAt` in the user list
- [ ] An admin can't read another person's `experienceAuthors` row
- [ ] A non-admin can't set `verified`, on create or on update
- [ ] `deleteCompany` refuses a company that has experiences, and a direct delete of a company is refused for everyone
- [ ] A member can't create a comment directly, or post a second vote or bookmark
- [ ] Agent tools are read-only (or disabled)
- [ ] No raw HTML rendering of user content
- [ ] `npm audit` shows no high-severity issues

## Answers from the review

1. **Can a permission rule hide individual fields from readers?** No. Read rules apply to whole records, and `writableFields` limits only what a role can *write*. Keep `experienceAuthors`.
2. **Does DeepSpace add an id, `createdAt` and a creator field automatically, and would that leak the author?** Yes to both. Every record has `recordId`, `createdBy`, `createdAt` and `updatedAt`. An action's tools act as the caller, the SDK saves the caller as `createdBy`, and the record is sent to every reader with it. Writing experiences as the app owner fixes this.
3. **How are "author only" and "owner only" rules written?** `'own'`. It checks `createdBy` by default, or the column named by `ownerField` (give that column `userBound: true` and `immutable: true`).
4. **Can records have custom ids?** Yes (`tools.create(collection, data, recordId)`). But `uniqueOn: ['experienceId', 'userId']` with a `userBound` `userId` is the built-in way to make duplicates impossible, and it's what this design uses.
5. **How do queries filter and sort, and is there text search?** Exact-match `where` (on columns, `recordId` or `createdBy`), one `orderBy` with `orderDir`, and `limit`/`offset` (50 per page by default). No "contains" and no text search, so some filters run in the browser (see above).
6. **How should actions update counters safely?** There's no atomic increment. Let `uniqueOn` stop duplicate votes, then recount and write the total instead of adding 1. Optionally add a nightly recount in `src/cron.ts`.
7. **What permissions do the agent data tools run with?** They run as the signed-in user, with your normal permission rules, and require app membership. Limit them by trimming `ALLOWED_TOOL_NAMES` in `src/ai/tools.ts`, narrow them with an `authorize` callback on `registerAgent`, or turn them off with `local: false, inApp: false`.
8. **Does `.gitignore` exclude every file that holds secrets?** Not quite. It covers `.dev.vars*`, `.wrangler`, `.deepspace`, `node_modules` and `dist`. Add `.env`, `.env.*` and `.claude/settings.local.json`. The app ID written into `wrangler.toml` on the first deploy isn't secret.
9. **How do I stop a member from setting `verified: true`?** `default: false` on the column and leave `verified`, `verifiedBy` and `verifiedAt` out of the member's `writableFields`. The server rejects the write on create and on update. No action is needed.

## Build order

Do one step at a time, and test each before moving on.

**Source control: this app uses GitHub as its source.**
- **Never run `npx deepspace push`.** It would permanently claim DeepSpace as the source instead of GitHub.
- **Add the GitHub remote before the first `npx deepspace deploy`.** That first deploy permanently claims GitHub.
- A deploy ships your local files **as they are**, uncommitted changes included. Commit before each deploy.

**Steps**

- [x] `.gitignore` additions, first commit, GitHub remote, first deploy (GitHub source claimed)
- [ ] Route skeleton (see the page map)
- [ ] `users` schema gets `roster: 'read-policy'`
- [ ] companies + positions schemas and shared data hooks, then seed data
- [ ] Agent tools become read-only (before production)
- [ ] owner-identity tools in `action-routes.ts`, then experiences + experienceAuthors + `createExperience`, anonymous by default. Check `createdBy` in DevTools.
- [ ] experiences list with filters, company and position pages
- [ ] `updateExperience` / `deleteExperience`, tested with a second account
- [ ] comments + replies + `postComment`
- [ ] helpfulVotes + `toggleHelpful`, bookmarks
- [ ] `setCompanyVerified`, `deleteCompany`
- [ ] Playwright tests: signed out, member, other member, admin
- [ ] Stretch: discussions, notifications
