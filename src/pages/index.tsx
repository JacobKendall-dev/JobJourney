/**
 * Landing page — a STATIC page.
 *
 * It lives at the top level of src/pages/ (not under (app)/), so it renders
 * with no DeepSpace providers: no auth session fetch, no records WebSocket.
 * That makes it cheap to serve and safe for logged-out / crawler traffic.
 *
 * Need live data or auth here? Move this file to src/pages/(app)/index.tsx
 * and it becomes a dynamic page. Conversely, any page you want to keep static
 * (marketing, docs, legal) belongs at this top level.
 *
 * Top-level pages are also prerendered to static HTML at build
 * (prerender.ts, via vite.config.ts) so crawlers read real content.
 * Keep them renderable without a browser: no window/document during render,
 * prose in HTML text, reveal animations in CSS keyframes rather than JS-driven
 * initial states. `<Seo>` comes first and reads src/seo.ts.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { APP_NAME } from '../constants'
import { seo } from '../seo'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="flex min-h-screen flex-col">
        {/* Static pages have no auth, so this bar has no account menu. */}
        <header className="border-b border-border">
          <div className="mx-auto flex h-12 w-full max-w-[1100px] items-center gap-4 px-4 sm:px-6">
            <Link to="/" className="text-sm font-semibold text-foreground">
              {APP_NAME}
            </Link>
            <Link to="/experiences" className="text-sm text-muted-foreground hover:text-foreground">
              Browse
            </Link>
            <Link to="/companies" className="text-sm text-muted-foreground hover:text-foreground">
              Companies
            </Link>
            <div className="flex-1" />
            <Link
              to="/experiences/new"
              className="hidden rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 sm:inline-flex"
            >
              Share your experience
            </Link>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <h1 className="mb-4 max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            See what happens after you apply.
          </h1>
          <p className="mb-8 max-w-md text-muted-foreground">
            Real application timelines, interview stages and advice, shared anonymously by job
            seekers.
          </p>

          {/* A plain GET form: it reaches /experiences?q=… even before JavaScript loads. */}
          <form
            action="/experiences"
            method="get"
            role="search"
            className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
          >
            <label htmlFor="landing-search" className="sr-only">
              Search by company or position
            </label>
            <input
              id="landing-search"
              name="q"
              type="search"
              placeholder="Search a company or position"
              className="h-10 w-full min-w-0 rounded-md border border-border bg-background px-3 sm:flex-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              className="h-10 rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              Search
            </button>
          </form>

          <Link
            to="/experiences/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Share your experience
          </Link>
        </main>
      </div>
    </>
  )
}
