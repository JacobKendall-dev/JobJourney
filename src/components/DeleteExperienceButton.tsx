/**
 * Delete an experience, after a confirmation, through the deleteExperience
 * action (author or admin; the action checks). Its votes, bookmarks and
 * comments go with it.
 */

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button, ConfirmModal, useToast, type ButtonProps } from '@/components/ui'
import { callAction } from '@/lib/actions'

interface DeleteExperienceButtonProps {
  experienceId: string
  /** Moderation wording for admins deleting someone else's post. */
  asAdmin?: boolean
  onDeleted?: () => void
  size?: ButtonProps['size']
}

export function DeleteExperienceButton({ experienceId, asAdmin, onDeleted, size = 'sm' }: DeleteExperienceButtonProps) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setPending(true)
    const result = await callAction('deleteExperience', { experienceId })
    setPending(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    setOpen(false)
    toast.success(asAdmin ? 'Experience removed.' : 'Your experience was deleted.')
    onDeleted?.()
  }

  return (
    <>
      <Button type="button" variant="outline" size={size} onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
        {asAdmin ? 'Delete (admin)' : 'Delete'}
      </Button>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        title={asAdmin ? 'Remove this experience?' : 'Delete your experience?'}
        description="Its helpful votes, bookmarks and comments are deleted too. This can't be undone."
        confirmText="Delete"
        variant="destructive"
        loading={pending}
      />
    </>
  )
}
