/**
 * Not found — any unknown URL. Static (top level of src/pages/), so it shows
 * no app header. Generouted's own `404.tsx` convention isn't used here: this
 * catch-all is the project's not-found page.
 */

import { Link } from 'react-router-dom'
import { APP_NAME } from '../constants'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <title>{`Not found · ${APP_NAME}`}</title>
      <meta name="robots" content="noindex" />
      <h1 className="mb-2 text-4xl font-bold text-foreground">404</h1>
      <p className="mb-6 text-muted-foreground">This page doesn't exist.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Home
        </Link>
        <Link
          to="/experiences"
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Browse experiences
        </Link>
      </div>
    </div>
  )
}
