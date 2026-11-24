/**
 * Settings — /settings. Signed in only (the (protected) layout).
 *
 * Your account details, sign out, and Delete account. A DeepSpace sign-in is
 * shared across DeepSpace apps, so deleting removes everything you have in
 * JobJourney (the deleteAccount action) and signs you out; it can't remove
 * the sign-in itself.
 *
 * Notifications: one switch for the daily comment digest (src/cron.ts),
 * saved on your own users row.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut, useMutations, useQuery, useUser } from 'deepspace'
import { Bell, LogOut, Trash2 } from 'lucide-react'
import { PageShell } from '@/components/PageShell'
import { Button, Input, Label, Modal, Switch, useToast } from '@/components/ui'
import { useRole } from '@/hooks/useRole'
import { isTrue } from '@/lib/options'
import type { UserPrefs } from '@/schemas/users-schema'
import { callAction } from '@/lib/actions'

const CONFIRM_WORD = 'DELETE'

export default function SettingsPage() {
  const { user } = useUser()

  return (
    <PageShell title="Settings">
      <div className="grid max-w-2xl gap-6">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-semibold text-foreground">Your account</h2>
          <dl className="mt-3 grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="text-foreground">{user?.name || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all text-foreground">{user?.email || '—'}</dd>
            </div>
          </dl>
          <Button variant="secondary" className="mt-4" onClick={() => signOut()}>
            <LogOut aria-hidden />
            Sign out
          </Button>
        </section>

        <NotificationsSection />

        <DeleteAccountSection />
      </div>
    </PageShell>
  )
}

function NotificationsSection() {
  const { userId } = useRole()
  const { error } = useToast()
  const { records, status } = useQuery<UserPrefs>('users', { where: { recordId: userId ?? '' } })
  const { ready, putConfirmed } = useMutations<UserPrefs>('users')
  const [saving, setSaving] = useState(false)
  const row = records.find((r) => r.recordId === userId)
  const on = isTrue(row?.data.notifyComments)

  async function toggle(next: boolean) {
    if (!userId || !row) return
    setSaving(true)
    try {
      await putConfirmed(userId, { notifyComments: next })
    } catch {
      error("Couldn't save your notification setting", 'Try again in a moment.')
    }
    setSaving(false)
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="notifications-title">
      <h2 id="notifications-title" className="flex items-center gap-2 text-base font-semibold text-foreground">
        <Bell className="size-4" aria-hidden />
        Notifications
      </h2>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <Label htmlFor="notify-comments">Daily comment summary</Label>
          <p id="notify-comments-help" className="mt-1 max-w-prose text-sm text-muted-foreground">
            One email a day, only when people have commented on your posts. It comes from DeepSpace's notification
            address and doesn't say which posts are yours to anyone else.
          </p>
        </div>
        <Switch
          id="notify-comments"
          aria-describedby="notify-comments-help"
          checked={on}
          disabled={!ready || !row || status !== 'ready' || saving}
          onCheckedChange={(next) => void toggle(next)}
        />
      </div>
    </section>
  )
}

function DeleteAccountSection() {
  const navigate = useNavigate()
  const { error } = useToast()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [pending, setPending] = useState(false)
  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD

  function close() {
    if (pending) return
    setOpen(false)
    setTyped('')
  }

  async function deleteAccount() {
    setPending(true)
    const result = await callAction('deleteAccount', { confirm: true })
    if (!result.success) {
      setPending(false)
      error("Couldn't delete your account", result.error)
      return
    }
    navigate('/', { replace: true })
    await signOut()
  }

  return (
    <section className="rounded-lg border border-destructive/40 bg-card p-4" aria-labelledby="delete-account-title">
      <h2 id="delete-account-title" className="text-base font-semibold text-foreground">
        Delete account
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Permanently removes everything you have in JobJourney: your experiences (with their votes, comments and
        bookmarks), your helpful votes, your bookmarks and your profile. Your comments on other posts show as
        “[deleted]” so replies still make sense. This can't be undone.
      </p>
      <Button variant="destructive" className="mt-4" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
        Delete account
      </Button>

      <Modal open={open} onClose={close} size="sm">
        <Modal.Header>
          <Modal.Title>Delete your account?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <form
            id="delete-account-form"
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (confirmed && !pending) void deleteAccount()
            }}
          >
            <p className="text-sm text-muted-foreground">
              Everything you have in JobJourney is deleted and you're signed out. Your DeepSpace sign-in itself stays,
              because it's shared with other DeepSpace apps; signing in again starts an empty profile.
            </p>
            <div className="grid gap-1.5">
              <Label htmlFor="delete-confirm">Type {CONFIRM_WORD} to confirm</Label>
              <Input
                id="delete-confirm"
                value={typed}
                autoComplete="off"
                autoCapitalize="characters"
                onChange={(e) => setTyped(e.target.value)}
                disabled={pending}
                autoFocus
              />
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="delete-account-form"
            variant="destructive"
            disabled={!confirmed}
            loading={pending}
          >
            Delete my account
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  )
}
