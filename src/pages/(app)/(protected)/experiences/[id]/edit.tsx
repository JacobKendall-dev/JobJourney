/**
 * Edit an experience — /experiences/:id/edit. Signed in; author only.
 *
 * The shared ExperienceForm, filled in, with company and position locked.
 * Saving calls updateExperience, which re-checks authorship on the server;
 * the author check here only decides what to show.
 */

import { useNavigate, useParams } from 'react-router-dom'
import { FileQuestion, Lock } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ExperienceCardSkeleton } from '@/components/ExperienceCard'
import { PageShell } from '@/components/PageShell'
import { ExperienceForm, formFromExperience } from '@/components/share/ExperienceForm'
import { useToast } from '@/components/ui'
import { useExperiences } from '@/hooks/useExperiences'
import { useMyAuthorship } from '@/hooks/useMyAuthorship'
import { useRole } from '@/hooks/useRole'
import { callAction } from '@/lib/actions'

export default function EditExperiencePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { success } = useToast()
  const { userId } = useRole()
  const { experiences, status } = useExperiences()
  const authorship = useMyAuthorship(userId)
  const detailUrl = `/experiences/${encodeURIComponent(id)}`

  if (status === 'loading' || authorship.status === 'loading' || !userId) {
    return (
      <PageShell title="Edit your experience">
        <ExperienceCardSkeleton />
      </PageShell>
    )
  }

  const experience = experiences.find((e) => e.recordId === id)
  if (!experience) {
    return (
      <PageShell title="Experience not found">
        <EmptyState
          icon={<FileQuestion aria-hidden />}
          title="This experience doesn't exist or was deleted."
          action={{ label: 'Your posts', to: '/me' }}
        />
      </PageShell>
    )
  }

  if (!authorship.experienceIds.has(id)) {
    return (
      <PageShell title="Edit an experience">
        <EmptyState
          icon={<Lock aria-hidden />}
          title="You can't edit this experience."
          description="Only the person who shared it can edit it."
          action={{ label: 'Back to the experience', to: detailUrl }}
        />
      </PageShell>
    )
  }

  return (
    <PageShell title="Edit your experience" description="Changes show up for everyone as soon as you save.">
      <ExperienceForm
        key={id}
        initial={formFromExperience(experience.data)}
        lockPlace
        submitLabel="Save changes"
        onCancel={() => navigate(detailUrl)}
        onSubmit={async (value) => {
          // Company and position are fixed; send only the content.
          const { companyId: _c, newCompany: _nc, positionId: _p, newPosition: _np, ...content } = value
          const result = await callAction('updateExperience', { experienceId: id, ...content })
          if (!result.success) return result.error
          success('Saved.', 'Your experience is updated.')
          navigate(detailUrl)
          return null
        }}
      />
    </PageShell>
  )
}
