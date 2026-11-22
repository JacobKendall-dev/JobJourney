/** My posts — /me. Signed in only. */

import { PageShell, Placeholder } from '@/components/PageShell'

export default function MyPostsPage() {
  return (
    <PageShell title="My posts" description="Only you can see this list.">
      <Placeholder>Your experiences arrive in the “Edit, My posts, Bookmarks” step.</Placeholder>
    </PageShell>
  )
}
