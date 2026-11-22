/**
 * Comments on an experience: top-level comments with one level of replies.
 *
 * - Posting goes through the `postComment` action, which sets the name from
 *   the account (or "Owner" for the experience's author) and recounts
 *   `commentCount`.
 * - You can reply to a top-level comment or to a reply. Either way the reply
 *   lands in the same thread, one level deep; a reply to a reply shows who it
 *   answers.
 * - Editing and deleting your own comment are direct writes the schema allows
 *   (`body` and `deleted` only), except "Owner" comments, which go through
 *   `updateAuthorComment`. Delete is soft: `deleted: true` and an empty body,
 *   so deleted text stops reaching browsers and replies keep their place.
 * - Bodies are plain text; React escapes them.
 */

import { useState, type FormEvent } from 'react'
import { useMutations, useQuery } from 'deepspace'
import { CornerDownRight, MessageSquare } from 'lucide-react'
import { Button, ConfirmModal, Textarea, useToast } from '@/components/ui'
import { SignInButton } from '@/components/SignInButton'
import { callAction } from '@/lib/actions'
import {
  COMMENT_MAX,
  OWNER_LABEL,
  buildThread,
  checkCommentBody,
  commentAuthorName,
  commentCountText,
  isByAuthor,
  isDeleted,
  isEdited,
  isOwnComment,
  type CommentRecord,
} from '@/lib/comments'
import type { Comment } from '@/schemas/comments-schema'

interface CommentThreadProps {
  experienceId: string
  userId: string | null
  /** The viewer wrote this experience, so their comments show as "Owner". */
  isAuthor: boolean
}

/** The comment being replied to, and the thread the reply will join. */
interface ReplyTarget {
  threadId: string
  commentId: string
  name: string
}

export function CommentThread({ experienceId, userId, isAuthor }: CommentThreadProps) {
  const { records, status, error } = useQuery<Comment>('comments', { where: { experienceId } })
  const comments = records as CommentRecord[]
  const thread = buildThread(comments)
  const byId = new Map(comments.map((c) => [c.recordId, c]))
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)

  const replyHandler = (threadId: string, comment: CommentRecord) =>
    userId && !isDeleted(comment)
      ? () =>
          setReplyTo(
            replyTo?.commentId === comment.recordId
              ? null
              : { threadId, commentId: comment.recordId, name: commentAuthorName(comment) },
          )
      : undefined

  const item = (threadId: string, comment: CommentRecord) => {
    const answering = comment.data.replyToId ? byId.get(comment.data.replyToId) : undefined
    return (
      <CommentItem
        comment={comment}
        mine={isOwnComment(comment, userId, isAuthor)}
        replyingToName={
          comment.data.replyToId ? (answering && !isDeleted(answering) ? commentAuthorName(answering) : '[deleted]') : undefined
        }
        onReply={replyHandler(threadId, comment)}
      />
    )
  }

  return (
    <section aria-labelledby="comments-heading" className="mt-10 border-t border-border pt-6">
      <h2 id="comments-heading" className="mb-4 text-base font-semibold text-foreground">
        {status === 'loading' ? 'Comments' : commentCountText(records.length)}
      </h2>

      {userId ? (
        <CommentForm
          experienceId={experienceId}
          label="Ask a question or add what you know"
          submitLabel="Comment"
          note={isAuthor ? `This is your post, so your comments here show as “${OWNER_LABEL}”.` : undefined}
        />
      ) : (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          <span>Have a question for the author?</span>
          <SignInButton>Sign in to comment</SignInButton>
        </div>
      )}

      {status === 'loading' ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading comments">
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : status === 'error' ? (
        <p className="text-sm text-destructive">Couldn't load comments. {error}</p>
      ) : thread.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="size-4" aria-hidden />
          No comments yet. Be the first to ask or add something useful.
        </p>
      ) : (
        <ol className="space-y-4">
          {thread.map(({ comment, replies }) => {
            const threadId = comment.recordId
            const replying = replyTo?.threadId === threadId ? replyTo : null
            return (
              <li key={threadId}>
                {item(threadId, comment)}
                {(replies.length > 0 || replying) && (
                  <ol className="mt-3 ml-4 space-y-3 border-l border-border pl-4 sm:ml-6">
                    {replies.map((reply) => (
                      <li key={reply.recordId}>{item(threadId, reply)}</li>
                    ))}
                    {replying && (
                      <li>
                        <CommentForm
                          key={replying.commentId}
                          experienceId={experienceId}
                          parentId={replying.commentId}
                          label={`Reply to ${replying.name}`}
                          heading={`Replying to ${replying.name}`}
                          submitLabel="Reply"
                          autoFocus
                          onDone={() => setReplyTo(null)}
                        />
                      </li>
                    )}
                  </ol>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function CommentForm({
  experienceId,
  parentId,
  label,
  heading,
  submitLabel,
  note,
  autoFocus,
  onDone,
}: {
  experienceId: string
  /** The comment being replied to (top-level or a reply). */
  parentId?: string
  label: string
  heading?: string
  submitLabel: string
  note?: string
  autoFocus?: boolean
  onDone?: () => void
}) {
  const [body, setBody] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const checked = checkCommentBody(body)
    if (!checked.ok) return setError(checked.error)
    setPending(true)
    setError(null)
    const result = await callAction('postComment', { experienceId, body: checked.body, parentId })
    setPending(false)
    if (!result.success) return setError(result.error)
    setBody('')
    onDone?.()
  }

  const fieldId = `comment-${parentId ?? 'new'}`
  return (
    <form onSubmit={submit} className="mb-6 space-y-2">
      {heading && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CornerDownRight className="size-3.5" aria-hidden />
          {heading}
        </p>
      )}
      <label htmlFor={fieldId} className="sr-only">
        {label}
      </label>
      <Textarea
        id={fieldId}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={label}
        maxLength={COMMENT_MAX}
        rows={3}
        autoFocus={autoFocus}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : undefined}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending ? 'Posting…' : submitLabel}
        </Button>
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {body.length}/{COMMENT_MAX.toLocaleString()}
        </span>
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {error && (
        <p id={`${fieldId}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

function CommentItem({
  comment,
  mine,
  replyingToName,
  onReply,
}: {
  comment: CommentRecord
  mine: boolean
  /** For a reply to a reply: who it answers. */
  replyingToName?: string
  onReply?: () => void
}) {
  const toast = useToast()
  const { ready, putConfirmed } = useMutations<Comment>('comments')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const owner = isByAuthor(comment)
  const canChange = mine && !isDeleted(comment)

  /** Owner comments are stored under the app's identity, so they change through an action. */
  async function write(change: { body: string } | { delete: true }) {
    if (owner) {
      const result = await callAction('updateAuthorComment', { commentId: comment.recordId, ...change })
      if (!result.success) throw new Error(result.error)
    } else {
      await putConfirmed(comment.recordId, 'delete' in change ? { deleted: true, body: '' } : { body: change.body })
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const checked = checkCommentBody(draft)
    if (!checked.ok) return setError(checked.error)
    setPending(true)
    try {
      await write({ body: checked.body })
      setEditing(false)
      setError(null)
    } catch (err) {
      setError(`Couldn't save: ${errorText(err)}`)
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    setPending(true)
    try {
      await write({ delete: true })
      setConfirmDelete(false)
    } catch (err) {
      toast.error(`Couldn't delete: ${errorText(err)}`)
    } finally {
      setPending(false)
    }
  }

  if (isDeleted(comment)) {
    return <p className="text-sm italic text-muted-foreground">[deleted]</p>
  }

  // Direct edits need the record room; Owner edits go through an action.
  const writable = owner || ready

  return (
    <article className="text-sm">
      <header className="mb-1 flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
        {owner ? (
          <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium text-primary">{OWNER_LABEL}</span>
        ) : (
          <span className="font-medium text-foreground">{commentAuthorName(comment)}</span>
        )}
        {replyingToName && (
          <span className="inline-flex items-center gap-1">
            <CornerDownRight className="size-3" aria-hidden />
            replying to {replyingToName}
          </span>
        )}
        <time dateTime={comment.createdAt}>{formatWhen(comment.createdAt)}</time>
        {isEdited(comment) && <span>(edited)</span>}
      </header>

      {editing ? (
        <form onSubmit={save} className="space-y-2">
          <label htmlFor={`edit-${comment.recordId}`} className="sr-only">
            Edit your comment
          </label>
          <Textarea
            id={`edit-${comment.recordId}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={COMMENT_MAX}
            rows={3}
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!writable || pending || !draft.trim()}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => (setEditing(false), setError(null))}>
              Cancel
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="whitespace-pre-line break-words text-foreground/90">{comment.data.body}</p>
      )}

      {!editing && (onReply || canChange) && (
        <div className="mt-1 flex gap-3 text-xs">
          {onReply && (
            <button type="button" onClick={onReply} className={linkClass}>
              Reply
            </button>
          )}
          {canChange && (
            <>
              <button
                type="button"
                disabled={!writable}
                onClick={() => (setDraft(comment.data.body ?? ''), setEditing(true))}
                className={linkClass}
              >
                Edit
              </button>
              <button type="button" disabled={!writable} onClick={() => setConfirmDelete(true)} className={linkClass}>
                Delete
              </button>
            </>
          )}
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Delete this comment?"
        description="It will show as [deleted] so replies still make sense. This can't be undone."
        confirmText="Delete"
        variant="destructive"
        loading={pending}
      />
    </article>
  )
}

const linkClass =
  'text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50'
