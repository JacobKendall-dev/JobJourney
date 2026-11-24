/**
 * Shown when the privacy check flags something in a post. The writer can go
 * back and edit, or share anyway: the check only advises.
 */

import { ShieldAlert } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import type { PrivacyFlag } from '@/lib/privacy'

export function PrivacyReviewModal({
  flags,
  submitLabel,
  onEdit,
  onContinue,
}: {
  /** Null when closed. */
  flags: PrivacyFlag[] | null
  submitLabel: string
  onEdit: () => void
  onContinue: () => void
}) {
  return (
    <Modal open={!!flags} onClose={onEdit} size="md">
      <Modal.Header>
        <Modal.Title>
          <span className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-warning" aria-hidden />
            Check before you share
          </span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-sm text-muted-foreground">
          These details could identify you or someone else. Consider removing or generalising them.
        </p>
        <ul className="mt-3 grid gap-2" aria-label="Flagged details">
          {(flags ?? []).map((flag) => (
            <li key={flag.quote} className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <q className="break-words font-medium text-foreground">{flag.quote}</q>
              <span className="mt-0.5 block text-muted-foreground">{flag.reason}</span>
            </li>
          ))}
        </ul>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onContinue}>
          {submitLabel} anyway
        </Button>
        <Button onClick={onEdit} autoFocus>
          Edit post
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
