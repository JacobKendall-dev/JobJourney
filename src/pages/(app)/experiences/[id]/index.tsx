/**
 * Experience detail — /experiences/:id. Public; interacting needs sign-in.
 *
 * This is `[id]/index.tsx`, not `[id].tsx`: a `[id].tsx` beside the `[id]/`
 * folder would become the parent route of `[id]/edit`, and the edit URL would
 * render this page instead.
 */

import { Link, useParams } from 'react-router-dom'
import { PageShell, Placeholder } from '@/components/PageShell'

export default function ExperienceDetailPage() {
  const { id } = useParams()

  return (
    <PageShell title="Experience" description={`Experience id: ${id}`}>
      <Placeholder>
        The full story, helpful, bookmark and comments arrive in the “Experience detail” step.{' '}
        <Link to={`/experiences/${id}/edit`} className="underline underline-offset-4">
          Edit (route check)
        </Link>
      </Placeholder>
    </PageShell>
  )
}
