# JobJourney Page Map

Nov 21, 2026 · @bocaj · revised after the DeepSpace review

## Overview

Every page JobJourney needs: its URL, what it shows, which data it reads and writes, and who can use it. It pairs with the **JobJourney Data Design** (`docs/JobJourney Data Design.md`). Collection, field and action names here match that doc.

**Two kinds of page** (how this project is set up):

- **Static:** files at the top level of `src/pages/`. No sign-in check, no live data, and prerendered to HTML at build so search engines read real content. Only the landing page (`/`) and the not-found page are static.
- **Live:** files under `src/pages/(app)/`, wrapped in DeepSpace's sign-in and realtime data layer. Files under `(app)/(protected)/` also require sign-in.

**Layout on every live page** (from `(app)/_layout.tsx`):

- **Header:** logo (→ `/`), **Browse**, **Companies**, a primary **Share your experience** button, then either **Sign in** or an account menu (My posts, Bookmarks, Admin for admins only, Sign out).
- **Main content** in one centered column, max \~1100 px wide.
- **Toasts** for rejected writes come from the layout's `onWriteError`, which is already wired.

The static landing page has its own small top bar (logo, Browse, Companies, Share). It has no account menu, because static pages don't check sign-in.

**Signed-out visitors** can read everything public: experiences, companies, comments. Any action that needs an account (helpful, bookmark, comment, share) shows a **"Sign in to ..." prompt** instead of failing. Personal pages live under `(protected)/`, whose layout shows a "Sign in to continue" panel.

**Pages at a glance**

Generouted file names: `(app)` and `(protected)` are groups and don't appear in the URL. `[id]` becomes `:id`, and `index.tsx` is the folder's own page.

| Page | URL | File under `src/pages/` | Who |
| --- | --- | --- | --- |
| Home (static) | `/` | `index.tsx` | everyone |
| Browse experiences | `/experiences` | `(app)/experiences/index.tsx` | everyone |
| Experience detail | `/experiences/:id` | `(app)/experiences/[id]/index.tsx` | everyone; interacting needs sign-in |
| Share an experience | `/experiences/new` | `(app)/(protected)/experiences/new.tsx` | signed in |
| Edit an experience | `/experiences/:id/edit` | `(app)/(protected)/experiences/[id]/edit.tsx` | author only |
| Companies | `/companies` | `(app)/companies/index.tsx` | everyone |
| Company profile | `/companies/:slug` | `(app)/companies/[slug].tsx` | everyone; admin buttons for admins |
| My bookmarks | `/bookmarks` | `(app)/(protected)/bookmarks.tsx` | signed in |
| My posts | `/me` | `(app)/(protected)/me.tsx` | signed in |
| Settings | `/settings` | `(app)/(protected)/settings.tsx` | signed in |
| Admin | `/admin` | `(app)/(protected)/admin.tsx` | admin only |
| Not found | any other URL | `[...all].tsx` (static) | everyone |

**Naming notes**

- The detail page is `experiences/[id]/index.tsx`, **not** `experiences/[id].tsx`. With a `[id].tsx` file next to an `[id]/` folder, Generouted makes the detail page the *parent* of `[id]/edit`, so `/experiences/x/edit` would show the detail page.
- `/experiences/new` and `/experiences/:id` sit in different groups. That's fine: React Router always prefers the fixed segment `new` over `:id`.
- Generouted treats only `src/pages/404.tsx` as a not-found page. This project uses the catch-all `[...all].tsx` instead, so there's no `404.tsx`.
- The scaffold's `(app)/home.tsx` placeholder is removed. Links that went to `/home` go to `/` or `/experiences`.
- The Admin menu item uses `roles: ['admin']` in `src/nav.ts`.

## Browsing pages

### Home — `/` (static)

**Purpose:** say in one glance what JobJourney is, and get people to an experience fast. Static and prerendered, so it loads instantly and search engines can read it.

- **Hero:** "See what happens after you apply." plus a short line ("Real application timelines, interview stages and advice, shared anonymously by job seekers.").
- **Search box:** a plain form that goes to `/experiences?q={text}`. It works even before JavaScript loads.
- **Share your experience** button → `/experiences/new`. Signed-out visitors see the sign-in panel there.
- **No live sections.** Recent and most helpful experiences live on Browse, whose default sort is Newest and which can switch to Most helpful.
- **Reads:** nothing. Static pages can't use data hooks.

### Browse experiences — `/experiences`

**Purpose:** the main research tool.

- **Data:** one live subscription to all experiences, plus companies and positions for names. Filtering, sorting, counting and paging all happen in the browser. In the browser, `useQuery` has `where`, `orderBy`, `orderDir` and `limit`, but no `offset` and no total, so paging on the server can't give a correct count or work with filters that run in the browser. At this size, loading everything is fine, and the list updates live.
- **Filter bar:** company, position, outcome, industry, interview format, work arrangement (Remote / Hybrid / On-site), applied month, a text box (`q`) matching company and position names, and sort by **Newest** or **Most helpful**.
- **Filters live in the URL** (`/experiences?company=example-technologies&outcome=offer&q=intern`), so a filtered view can be shared or bookmarked, and links from the home search and company pages land pre-filtered. The URL uses the company's `slug`; the page looks up its ID.
- **Results:** a count ("24 experiences"), then experience cards, then **Load more**, which shows 20 more of the filtered results.
- **Clear filters** link whenever any filter is on.
- **Empty state:** "No experiences match these filters yet." with "Clear filters" and "Share yours".
- **Reads:** experiences, companies, positions.

### Experience detail — `/experiences/:id`

**Purpose:** the full story of one application, plus discussion.

- **Header:** position title, company name (link to its profile) with **Verified** badge if `verified`, outcome badge (Offer / Rejected / Ghosted / Withdrew / In progress).
- **Byline:** "Shared anonymously" or "Shared by {authorName}", plus "Applied {appliedMonth}". The page doesn't show the exact posting time. That's a display choice only: `createdAt` still reaches the browser.
- **Timeline facts:**
  - First response: "8 days", or "No response yet" when `noResponse` is true.
  - Work arrangement: Remote, Hybrid or On-site, when given.
  - Interview stages: "3".
  - Interview format chips.
- **Interview experience** and **Advice** as plain text (never rendered as HTML).
- **Action row:**
  - **Helpful (12)** → `toggleHelpful`. Filled when you've voted (your own `helpfulVotes` row). Hidden on your own post. Signed out → sign-in prompt. The button shows a pending state while the action runs.
  - **Bookmark** → creates or deletes your `bookmarks` row. Disabled until `useMutations().ready`.
  - **Edit / Delete** only if you're the author. Query `experienceAuthors` with `where: { experienceId, createdBy: user.id }`. Everyone, admins included, can only read their own rows, so a row comes back only for the author. Delete asks for confirmation, then `deleteExperience`.
  - **Delete** for admins (moderation), same action, shown based on the user's role.
- **Comments:**
  - Top-level comments with one level of replies. You can reply to a comment or to a reply; both land in the same thread, and a reply to a reply shows "replying to …".
  - The experience's author shows as **Owner** in its comments.
  - Each shows `authorName`, "edited" if `updatedAt > createdAt`, and "\[deleted\]" for soft-deleted ones.
  - Comment box (signed in) → `postComment`.
  - Your own comments get **Edit** and **Delete** (soft delete: `deleted: true`, `body: ""`).
- **Not found:** "This experience doesn't exist or was deleted." with a link to Browse.
- **Reads:** the experience, its company and position, comments, your vote, bookmark and author row.
- **Writes:** `toggleHelpful`, `postComment` and `deleteExperience` through actions; bookmarks and comment edits directly.

## Sharing pages

### Share an experience — `/experiences/new`

**Purpose:** the most important form in the app. It should feel safe and quick.

One page, in four short sections:

1. **Where you applied**
   - **Company:** type to search existing companies. Not found → **"+ Add {name}"** opens a small form (name, industry, headquarters city, website). It **saves nothing yet**: the company shows as "New: added when you share", and `createExperience` adds it (**unverified**) when the post is shared, so an abandoned form leaves nothing behind. If the slug is taken, it says "That company already exists" with **Use it**.
   - **Position:** pick from that company's positions, or **"+ Add a position"** (title, level, category). Like a new company, it's held in the form, shown as "(new)", and added on share. A position already listed is picked instead. A new company has no positions, so the form opens straight away.
   - **Applied:** month and year picker (→ `appliedMonth`, `2026-09`). Future months disabled.
   - **Work arrangement** (optional): Remote, Hybrid or On-site (→ `workArrangement`).
2. **How it went**
   - **First response:** number of days, or a **"No response yet"** option. That sets `noResponse: true` and leaves `firstResponseDays` empty. Leaving both empty means "didn't say".
   - **Interview stages:** stepper, 0–10.
   - **Interview formats:** selectable chips (phone screen, online assessment, technical, behavioral, take-home, final round).
   - **Outcome:** five large selectable options (Offer, Rejected, Ghosted, Withdrew, In progress).
3. **Your story**
   - **Interview experience** and **Advice for others**: text areas with live character counters (2,000 each). At least one is required.
   - **Privacy notice** right above them: "Don't include names, emails or anything that could identify you or others. Don't share confidential interview questions."
4. **Post as**
   - **Anonymous (default)** vs **Show my name** as two clear options, not a small checkbox.
   - Under anonymous: "Your name isn't stored on the post. Only you can see that you wrote it."

- **Preview:** a live experience card on the right (desktop) or below (mobile) showing exactly how the post will look.
- **Privacy check:** pressing Share (or Save changes, when the story text changed) first calls `reviewPrivacy`. The button reads "Checking for personal details…". If anything is flagged, a **Check before you share** dialog lists each quote with its reason, with **Edit post** (focuses the story) and **Share anyway**. Pressing the button again with the same text reuses the last result. If the check can't run, the post is shared as normal.
- **Submit** → `createExperience` → go to the new experience's page with a toast "Thanks for sharing."
- **Validation:** check in the form for fast feedback (required fields, limits), but the action re-checks everything on the server.
- **Pre-fill:** `/experiences/new?company=example-technologies` pre-selects the company. It's used by "Share an experience here" on company pages.

### Edit an experience — `/experiences/:id/edit`

- Same form, filled in. **Company and position can't change**: they're `immutable` in the schema, so the server refuses changes too. To change them, delete and re-post.
- **Post as** can be switched. `updateExperience` sets `authorName` from your account when "Show my name" is on and clears it when it's off. It never uses a name sent from the browser.
- Only the author can open it. Anyone else sees "You can't edit this experience" (the action refuses anyway).
- **Save** → `updateExperience`. **Cancel** → back to the detail page.

## Company pages

### Companies — `/companies`

- **Search box** (name, browser filter) and **industry** filter.
- **Company rows or cards:** name, **Verified** badge, industry, location, and number of experiences (counted in the browser from the experiences subscription).
- **Sort:** most experiences, or A–Z.
- **"+ Add a company"** for signed-in members (same small form as on the share page, with `createConfirmed`). New companies show an **Unverified** label.
- **Empty search:** "No company called '{text}' yet. Add it?"

### Company profile — `/companies/:slug`

- **Header:** company name, **Verified** badge or a quiet "Unverified · added by the community" label, industry, headquarters city, website link.
- **At a glance** (computed in the browser from this company's experiences):
  - number of experiences
  - outcome breakdown (e.g., 6 offers · 10 rejected · 5 ghosted)
  - typical first response (median days, ignoring "no response yet")
  - typical number of interview stages
- **Positions:** list with each position's experience count. Clicking one filters the experiences below (`?position=...` in the URL).
- **Experiences:** cards for this company, newest first, with the same sort options as Browse.
- **"Share an experience here"** button → `/experiences/new?company={slug}`.
- **Admins only:**
  - **Verify** / **Remove verification** → `setCompanyVerified`.
  - **Delete company** → `deleteCompany`. It's disabled, with "Has N experiences" beside it, when the company has experiences; the action refuses anyway.
- **Not found:** "We don't have a company at this address." plus search.
- *Stretch:* a **Discussions** tab for questions before applying.

## Personal and admin pages

### My bookmarks — `/bookmarks`

- Signed in only. Lists your saved experiences as cards (your own `bookmarks` rows, then the matching experiences), newest saved first.
- Each card has **Remove**.
- **Empty state:** "Nothing saved yet. Tap the bookmark on any experience to keep it here."

### My posts — `/me`

- Signed in only. A small note at the top: **"Only you can see this list."** That reassures people their anonymous posts stay anonymous. It's true for every user of the app, admins included: each person can read only their own `experienceAuthors` rows. The data design's remaining risks cover what the app's owner could still do.
- Your experiences (your `experienceAuthors` rows, then the matching experiences) with **Edit** and **Delete** on each.
- Each shows its helpful count and comment count, so authors see their posts helping.
- **Empty state:** "You haven't shared anything yet." plus **Share your experience**.

### Settings — `/settings`

- Signed in only. Your name and email, and **Sign out**.
- **Notifications:** a **Daily comment summary** switch, off by default, saved as `notifyComments` on your own `users` row.
- **Delete account:** explains what goes, then a dialog where you type DELETE to confirm. It calls `deleteAccount`, then signs you out and goes home.
- A DeepSpace sign-in is shared by every DeepSpace app, so the app can't delete the sign-in itself. Deleting removes everything you have in JobJourney; signing in again starts an empty profile.

### Admin — `/admin`

Visible in the menu only for admins. The page checks the role, and every admin action re-checks it on the server.

- **Sample data:** a **Load sample data** button (`seedSampleData`) adds five clearly-labelled sample companies with their positions. Safe to press more than once.
- **Unverified companies:** a queue with name, website, date added, and **Verify** buttons (`setCompanyVerified`).
- **Companies with no experiences:** candidates for cleanup, with **Delete** (`deleteCompany`, which also removes the company's positions).
- **Recent experiences:** newest posts with **Delete** for moderation (`deleteExperience`). Admins don't see who wrote them.
- **Positions:** a position can be deleted only when no experience uses it. The schema allows any admin delete, so the page hides the button for positions in use.

### Not found — any unknown URL

- Static `[...all].tsx`: "This page doesn't exist." with links to Home (`/`) and Browse (`/experiences`).

## Shared components and states

Build these once and reuse them, so every page looks and behaves the same. The scaffold already provides `Badge`, `EmptyState`, `Tooltip`, `Dialog`, `SearchInput`, `Select`, `Textarea` and `Toast` in `src/components/ui`; the components below wrap them.

**Data hooks (build first, before any visuals):**

| Hook | What it does |
| --- | --- |
| **useLookups** | Subscribes to companies and positions; returns maps by ID and by slug, because URLs use slugs while records store IDs. |
| **useExperiences** | The one experiences subscription. Joins company and position, applies the filters, search and sort that run in the browser, and returns the results and their count. Browse, Companies, Company profile, Bookmarks and My posts all use it. |
| **useExperienceFilters** | Reads and writes the filters in the URL (`company`, `position`, `outcome`, `industry`, `format`, `month`, `q`, `sort`). |
| **callAction** | Calls `/api/actions/:name` with the signed-in user's token and returns the action's result. The SDK serves the route but has no browser helper for it. |

**Components:**

| Component | Used on | What it does |
| --- | --- | --- |
| **ExperienceCard** (+ skeleton) | Browse, Company, Bookmarks, My posts, share preview | Position, company + Verified badge, outcome badge, applied month, first response, stages, format chips, a 2-line excerpt of the advice, helpful and comment counts. Whole card links to the detail page. |
| **OutcomeBadge** | cards, detail | One color per outcome: offer = green, rejected = red, ghosted = gray, withdrew = neutral, in progress = blue. Always shows the word too, not color alone. |
| **VerifiedBadge** | cards, company pages | A check icon + "Verified". Tooltip: "An admin confirmed this is a real company." |
| **FilterBar** | Browse, Company | Filters + sort, using `useExperienceFilters`. |
| **CompanyPicker / PositionPicker** | Share form | Search-as-you-type with "+ Add" at the bottom. New ones are added by `createExperience` on share. |
| **HelpfulButton / BookmarkButton** | detail, cards | Shows your state. Signed out → sign-in prompt. Disabled until ready or while pending. |
| **CommentThread** | detail | Comments, one level of replies, edit/delete for your own, "\[deleted\]" placeholders. |
| **SignInPrompt** | anywhere | "Sign in to {mark helpful / comment / bookmark}" with a Sign in button that opens the SDK's `AuthOverlay`. |
| **EmptyState / NotFound** | every list, detail and company pages | Icon, one line, and the next step as a button. |

**States every page handles**

- **Loading:** gray skeleton cards in place of real ones (no blank page, no spinner on its own).
- **Empty:** the page's EmptyState with a useful next step.
- **Not found:** a friendly message with a way back.
- **Write rejected:** plain record writes are fire-and-forget. The UI updates first, and a rejection arrives as the layout's toast (`onWriteError`), e.g. "You can only edit your own comment". Writes the next step depends on (adding a company on the Companies page) use `createConfirmed` and show the error inline.
- **Not ready:** write buttons stay disabled until `useMutations().ready`.
- **Signed out:** read-only, with sign-in prompts in place of buttons.
- **Mobile:** single column; Browse filters collapse behind a **Filters** button; the share form's preview moves below the form.

**Content rules**

- All user text renders as **plain text**. No HTML, no markdown.
- Long text keeps line breaks but never runs wider than the column.
- Dates show as "Sep 2026", never exact timestamps on experiences.

## Key flows and build notes

**The four flows to demo and test end to end**

1. **Research:** visitor lands on Home → searches a company → Browse, pre-filtered → company profile → filters to a position → opens an experience. *(No sign-in needed.)*
2. **Share:** member clicks Share → adds a new company inline → fills the form, stays anonymous → submits → sees the post → finds it on My posts. *Check in DevTools that the post's `createdBy` is the app owner.*
3. **Discuss:** second member opens that experience → marks it helpful (count goes up live in the first member's browser) → comments → first member replies.
4. **Moderate:** admin opens Admin → verifies the new company → the Verified badge appears for everyone live.

Flows 3 and 4 show off DeepSpace's realtime sync, so they're good for the demo and the write-up.

**Build order** (follows the data design)

- [ ] Route skeleton: every page file in place with a placeholder, static landing with hero, search and Share, header and account menu, not-found page
- [ ] Shared data hooks: schemas for companies and positions, `useLookups`, `useExperienceFilters`, `callAction`
- [ ] ExperienceCard, OutcomeBadge, VerifiedBadge, EmptyState
- [ ] Companies list + Company profile (with seed data)
- [ ] Share form + `createExperience`
- [ ] Browse with filters
- [x] Experience detail: helpful, bookmark, comments
- [x] Edit, My posts, Bookmarks
- [x] Admin, including `deleteCompany`
- [x] Loading, empty and mobile states pass
