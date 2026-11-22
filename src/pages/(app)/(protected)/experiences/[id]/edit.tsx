/** Edit an experience — /experiences/:id/edit. Signed in; author only (checked in a later step). */

import { useParams } from 'react-router-dom'
import { PageShell, Placeholder } from '@/components/PageShell'

export default function EditExperiencePage() {
  const { id } = useParams()

  return (
    <PageShell title="Edit your experience" description={`Experience id: ${id}`}>
      <Placeholder>The edit form and the author check arrive in the “Edit, My posts, Bookmarks” step.</Placeholder>
    </PageShell>
  )
}
