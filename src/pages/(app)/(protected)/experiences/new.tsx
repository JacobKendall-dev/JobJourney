/**
 * Share an experience — /experiences/new. Signed in only (the (protected) layout).
 *
 * The shared ExperienceForm; submitting calls the createExperience action.
 * `?company=<slug>` pre-selects the company.
 */

import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageShell } from '@/components/PageShell'
import { EMPTY_FORM, ExperienceForm } from '@/components/share/ExperienceForm'
import { useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'

export default function ShareExperiencePage() {
  const navigate = useNavigate()
  const { success } = useToast()
  const [searchParams] = useSearchParams()

  return (
    <PageShell title="Share your experience" description="It takes about three minutes. Anonymous by default.">
      <ExperienceForm
        initial={EMPTY_FORM}
        prefillSlug={searchParams.get('company')}
        submitLabel="Share experience"
        onSubmit={async (value) => {
          const result = await callAction<{ experienceId: string }>('createExperience', { ...value })
          if (!result.success) return result.error
          success('Thanks for sharing.', 'Your experience is live.')
          navigate(`/experiences/${encodeURIComponent(result.data.experienceId)}`)
          return null
        }}
      />
    </PageShell>
  )
}
