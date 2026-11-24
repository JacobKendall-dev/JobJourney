# JobJourney

**Real interview experiences, shared anonymously, so the next person knows what they're walking into.**

🔗 **Live app: [jobjourney.app.space](https://jobjourney.app.space)**

---

## Why I built this

If you've applied for jobs recently, you know the feeling: you send an application and it disappears. You don't know how long a company usually takes to reply, how many rounds to expect, whether there's a take-home, or whether people tend to hear back at all.

That information exists. It lives in the heads of everyone who applied before you. But most people won't share it publicly, because it's tied to their name and their career.

JobJourney is my answer to that. It's a place to share how an application actually went (the timeline, the interview stages, the outcome and some advice) **without putting your name on it**. Each post makes the process a little less of a black box for the next applicant.

I built it as a take-home project, and I treated it as a real product: designed the data model first, built it in small tested steps, and deployed it.

## What you can do

- **Browse experiences** without signing in. Filter by company, position, industry, outcome, interview format, work arrangement and month applied, or search by name.
- **See company profiles** with the numbers that matter to an applicant: the typical time to a first response, the usual number of interview stages, and how applications ended (offer, rejected, ghosted, withdrew or still in progress).
- **Share your own experience** in a four-part form: where you applied, how it went, your story, and whether to post anonymously or with your name. A live preview shows exactly what others will see.
- **Get a privacy check before posting.** If your story mentions a person's name, an email address or something specific enough to identify you, a dialog points it out before you share.
- **Engage with posts:** mark posts helpful, bookmark them, and comment. If you reply on your own anonymous post, the reply shows as "Owner", not your name.
- **Manage your posts:** edit or delete them, turn on a daily email when people comment, or delete your account and everything in it.
- **Admins** verify companies, clean up unused listings and moderate posts.

## Try it

1. Open **[jobjourney.app.space](https://jobjourney.app.space)**. Browsing works without an account.
2. To share, vote, bookmark or comment, click **Sign in**. It uses a DeepSpace account; you can sign in with GitHub or Google.
3. Press **Share your experience** and fill in the form. Your post appears on Browse right away.

## How anonymity actually works

Hiding a name in the interface isn't enough when the app syncs records to every browser in real time. Anyone with DevTools could read the raw record and see who created it. So anonymity is enforced in the data model:

- **The app saves every post itself, not under the author's account.** Every post's `createdBy` is the same app identity, so a post's data can't be traced to its author.
- **Who wrote what is stored in a separate private collection** (`experienceAuthors`) that only the author can read. That's how "My posts", editing and "Owner" replies work.
- **New companies and positions** added while sharing are also created by the app, at the moment the post is shared, so they can't be matched to the post either.
- **Server logs** record `caller=[private]` for anything to do with authorship.
- **Signed-in users can't see a list of every user**, so nobody can match a post's timing to who was online.

## Run your own copy

You'll need **Node 22.15+ (or 24 / 26)**, **npm 11.6+** and a free **[DeepSpace](https://deep.space)** account.

```bash
git clone https://github.com/JacobKendall-dev/JobJourney.git
cd JobJourney
npm install

npx deepspace auth login          # opens your browser to sign in
npx deepspace app init --new-id   # registers your own separate copy (your own data)
```

The app's subdomain comes from `APP_NAME` in `wrangler.toml`, and `jobjourney` is already taken. Change it to something of your own before you deploy.

```bash
npx deepspace dev start           # local dev server at http://localhost:5173
```

Sign in, open **Admin** from the account menu (the account that registered the app is its admin), and press **Load sample data** to fill the app with example companies and posts.

Other useful commands:

```bash
npx deepspace test run all   # unit tests (Vitest) + browser tests (Playwright)
npm run lint
npx deepspace deploy         # publish to https://<your-app-name>.app.space
```

The privacy check and the comment email use paid DeepSpace integrations, billed to your DeepSpace credits. Both have daily caps, and you can switch each one off in `src/lib/paid-limits.ts`. If credits run out, sharing and commenting keep working without them.

## Built with

- **[DeepSpace](https://deep.space)** on **Cloudflare Workers** and Durable Objects: real-time synced records, auth, role-based permissions, server actions, scheduled tasks
- **React 19**, **TypeScript**, **Tailwind CSS v4**, file-based routing
- **Claude Haiku** for the privacy check, and transactional email for the comment digest, both through DeepSpace integrations
- **Vitest** (213 unit tests) and **Playwright** (36 browser tests at phone and desktop widths)

## Where to look in the code

| Path | What's there |
| --- | --- |
| `src/schemas/` | Every collection and its permission rules |
| `src/actions/` | Server actions: sharing, editing, voting, comments, admin, account deletion, privacy check |
| `src/lib/` | Validation, filtering, stats and other logic, tested on its own |
| `src/pages/` | Every route in the app |
| `src/components/share/` | The share form, company and position pickers, privacy dialog |
| `src/cron.ts` | The daily comment digest |
| `docs/` | The data design and page map I wrote before building, kept up to date as the plan changed |

## Decisions worth mentioning

- **Every write that matters goes through a server action.** Actions run with permissions off, so each one checks the caller's role and the records it touches itself. These checks have unit tests.
- **Mistakes don't leave junk behind.** Adding a company or position while sharing saves nothing until the post is actually shared. If a later step fails, they're removed again.
- **Paid features stay optional.** The privacy check and the email digest only advise or inform. If they fail, are capped or run out of credits, the app works exactly as it did before.
- **Deleting your account deletes your data.** Your posts, votes, bookmarks and profile are removed. Your comments become "[deleted]" so the replies to them still make sense.
- **Mobile is part of the test suite.** Every main page is checked at phone and desktop widths for console errors and sideways scrolling.
