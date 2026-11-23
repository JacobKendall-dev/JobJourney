/**
 * The experience form, shared by Share (/experiences/new) and Edit
 * (/experiences/:id/edit): four short sections and a live preview. It
 * validates with the same rules the actions re-check on the server
 * (src/lib/experience-input.ts); the page decides what submitting does.
 *
 * When editing, company and position are fixed (immutable in the schema) and
 * shown as text instead of pickers.
 */

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Lock, Minus, Plus, ShieldCheck } from 'lucide-react'
import { ExperienceCard } from '@/components/ExperienceCard'
import { CompanyPicker } from '@/components/share/CompanyPicker'
import { PositionPicker } from '@/components/share/PositionPicker'
import { Button, Label, Textarea } from '@/components/ui'
import { useLookups } from '@/hooks/useLookups'
import { useRole } from '@/hooks/useRole'
import type { Experience } from '@/lib/experience'
import {
  EARLIEST_YEAR,
  MAX_RESPONSE_DAYS,
  MAX_STAGES,
  STORY_MAX,
  validateNewExperience,
  type ExperienceErrors,
  type NewExperience,
} from '@/lib/experience-input'
import {
  INTERVIEW_FORMATS,
  LABELS,
  LEVELS,
  OUTCOMES,
  WORK_ARRANGEMENTS,
  isOneOf,
  isTrue,
  labelFor,
  type InterviewFormat,
} from '@/lib/options'
import { cn } from '@/lib/utils'

export interface FormState {
  companyId: string | null
  positionId: string | null
  year: string
  month: string
  workArrangement: string
  firstResponseDays: string
  noResponse: boolean
  interviewStages: number
  interviewFormats: InterviewFormat[]
  outcome: string
  interviewExperience: string
  advice: string
  showName: boolean
}

export const EMPTY_FORM: FormState = {
  companyId: null,
  positionId: null,
  year: '',
  month: '',
  workArrangement: '',
  firstResponseDays: '',
  noResponse: false,
  interviewStages: 0,
  interviewFormats: [],
  outcome: '',
  interviewExperience: '',
  advice: '',
  showName: false,
}

/** The form filled in from a saved experience, for editing. */
export function formFromExperience(e: Experience): FormState {
  const [year = '', month = ''] = (e.appliedMonth ?? '').split('-')
  const formats = Array.isArray(e.interviewFormats) ? e.interviewFormats : []
  return {
    companyId: e.companyId,
    positionId: e.positionId,
    year,
    month,
    workArrangement: isOneOf(WORK_ARRANGEMENTS, e.workArrangement) ? e.workArrangement : '',
    firstResponseDays: typeof e.firstResponseDays === 'number' ? String(e.firstResponseDays) : '',
    noResponse: isTrue(e.noResponse),
    interviewStages: typeof e.interviewStages === 'number' ? e.interviewStages : 0,
    interviewFormats: INTERVIEW_FORMATS.filter((f) => formats.includes(f)),
    outcome: e.outcome ?? '',
    interviewExperience: e.interviewExperience ?? '',
    advice: e.advice ?? '',
    showName: !isTrue(e.isAnonymous),
  }
}

const MONTH_NAMES =['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** How many years back the picker offers (the server accepts back to EARLIEST_YEAR). */
const YEARS_SHOWN = 6

/** What the validator and the action receive. */
function toInput(form: FormState) {
  const days = form.firstResponseDays.trim()
  return {
    companyId: form.companyId ?? '',
    positionId: form.positionId ?? '',
    appliedMonth: form.year && form.month ? `${form.year}-${form.month}` : '',
    workArrangement: form.workArrangement || undefined,
    // A non-number stays a string so the validator reports it.
    firstResponseDays: days === '' ? undefined : /^\d+$/.test(days) ? Number(days) : days,
    noResponse: form.noResponse,
    interviewStages: form.interviewStages,
    interviewFormats: form.interviewFormats,
    outcome: form.outcome,
    interviewExperience: form.interviewExperience,
    advice: form.advice,
    showName: form.showName,
  }
}

function localNow() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive'

export interface ExperienceFormProps {
  initial: FormState
  /** Editing: company and position are fixed and shown as text. */
  lockPlace?: boolean
  /** Share: a company slug to pre-select once companies load. */
  prefillSlug?: string | null
  submitLabel: string
  /** Called with the validated form. Resolve to an error message, or null on success. */
  onSubmit: (value: NewExperience) => Promise<string | null>
  onCancel?: () => void
}

export function ExperienceForm({ initial, lockPlace, prefillSlug, submitLabel, onSubmit, onCancel }: ExperienceFormProps) {
  const { status, companyBySlug, companyById, positionById } = useLookups()
  const { user } = useRole()

  const [form, setForm] = useState<FormState>(initial)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // ?company=<slug> pre-selects the company once the list has loaded.
  const [prefilled, setPrefilled] = useState(false)
  useEffect(() => {
    if (prefilled || status !== 'ready' || !prefillSlug) return
    const company = companyBySlug.get(prefillSlug)
    if (company) setForm((f) => ({ ...f, companyId: company.recordId }))
    setPrefilled(true)
  }, [prefilled, status, prefillSlug, companyBySlug])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setServerError(null)
  }

  const checked = useMemo(() => validateNewExperience(toInput(form)), [form])
  const errors: ExperienceErrors = submitted && !checked.ok ? checked.errors : {}

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (!checked.ok) {
      // Move focus to the first problem so keyboard and screen-reader users find it.
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    setSubmitting(true)
    const error = await onSubmit(checked.value)
    setSubmitting(false)
    if (error) setServerError(error)
  }

  const { year: thisYear, month: thisMonth } = localNow()
  const recentYears = Array.from({ length: YEARS_SHOWN }, (_, i) => String(thisYear - i)).filter(
    (y) => Number(y) >= EARLIEST_YEAR,
  )
  // Keep an older saved year selectable when editing.
  const years = form.year && !recentYears.includes(form.year) ? [...recentYears, form.year] : recentYears
  const lockedCompany = form.companyId ? companyById.get(form.companyId) : undefined
  const lockedPosition = form.positionId ? positionById.get(form.positionId) : undefined

  // Live preview with what's been entered so far.
  const preview: Experience = {
    companyId: form.companyId ?? '',
    positionId: form.positionId ?? '',
    isAnonymous: !form.showName,
    authorName: form.showName ? user?.name : undefined,
    appliedMonth: form.year && form.month ? `${form.year}-${form.month}` : '',
    workArrangement: form.workArrangement || undefined,
    firstResponseDays: /^\d+$/.test(form.firstResponseDays) ? Number(form.firstResponseDays) : undefined,
    noResponse: form.noResponse,
    interviewStages: form.interviewStages,
    interviewFormats: form.interviewFormats,
    outcome: form.outcome || 'in_progress',
    interviewExperience: form.interviewExperience,
    advice: form.advice,
    helpfulCount: 0,
    commentCount: 0,
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
          {/* 1. Where you applied */}
          <Section number={1} title="Where you applied">
            {lockPlace ? (
              <div className="rounded-lg border border-border bg-card p-3 text-sm">
                <p className="font-medium text-foreground">
                  {lockedPosition?.data.title ?? 'Unknown position'}
                  {lockedPosition && (
                    <span className="font-normal text-muted-foreground"> · {labelFor(LEVELS, lockedPosition.data.level)}</span>
                  )}
                </p>
                <p className="text-muted-foreground">{lockedCompany?.data.name ?? 'Unknown company'}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="size-3.5" aria-hidden />
                  Company and position can't be changed. To change them, delete this post and share it again.
                </p>
              </div>
            ) : (
              <>
                <Field label="Company" htmlFor="share-company" error={errors.companyId} errorId="share-company-error">
                  <CompanyPicker
                    value={form.companyId}
                    error={errors.companyId}
                    onChange={(companyId) => setForm((f) => ({ ...f, companyId, positionId: null }))}
                  />
                </Field>
                <Field label="Position" htmlFor="share-position" error={errors.positionId} errorId="share-position-error">
                  <PositionPicker
                    companyId={form.companyId}
                    value={form.positionId}
                    error={errors.positionId}
                    onChange={(positionId) => set('positionId', positionId)}
                  />
                </Field>
              </>
            )}
            <Field label="When you applied" htmlFor="share-month" error={errors.appliedMonth}>
              <div className="flex flex-wrap gap-2">
                <select
                  id="share-month"
                  aria-label="Month"
                  value={form.month}
                  aria-invalid={!!errors.appliedMonth}
                  onChange={(e) => set('month', e.target.value)}
                  className={selectClass}
                >
                  <option value="">Month</option>
                  {MONTH_NAMES.map((name, i) => {
                    const value = String(i + 1).padStart(2, '0')
                    const future = Number(form.year) === thisYear && i + 1 > thisMonth
                    return (
                      <option key={value} value={value} disabled={future}>
                        {name}
                      </option>
                    )
                  })}
                </select>
                <select
                  aria-label="Year"
                  value={form.year}
                  aria-invalid={!!errors.appliedMonth}
                  onChange={(e) => {
                    const year = e.target.value
                    // Picking this year after a later month clears the month.
                    const clearMonth = Number(year) === thisYear && Number(form.month) > thisMonth
                    setForm((f) => ({ ...f, year, month: clearMonth ? '' : f.month }))
                  }}
                  className={selectClass}
                >
                  <option value="">Year</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <Hint>Month only, never the exact day, so a post is harder to trace back to you.</Hint>
            </Field>
            <ChoiceGroup
              legend="Work arrangement"
              optional
              name="workArrangement"
              options={WORK_ARRANGEMENTS.map((v) => ({ value: v, label: LABELS[v] }))}
              value={form.workArrangement}
              onChange={(v) => set('workArrangement', v)}
              allowClear
              error={errors.workArrangement}
            />
          </Section>

          {/* 2. How it went */}
          <Section number={2} title="How it went">
            <Field label="First response" htmlFor="share-days" error={errors.firstResponseDays}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    id="share-days"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_RESPONSE_DAYS}
                    value={form.firstResponseDays}
                    disabled={form.noResponse}
                    aria-invalid={!!errors.firstResponseDays}
                    onChange={(e) => set('firstResponseDays', e.target.value)}
                    className={cn(selectClass, 'w-24')}
                  />
                  <span className="text-sm text-muted-foreground">days after applying</span>
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.noResponse}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        noResponse: e.target.checked,
                        firstResponseDays: e.target.checked ? '' : f.firstResponseDays,
                      }))
                    }
                    className="size-4 accent-primary"
                  />
                  No response yet
                </label>
              </div>
              <Hint>Optional. Leave it empty if you don't remember.</Hint>
            </Field>

            <Field label="Interview stages" htmlFor="share-stages" error={errors.interviewStages}>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  aria-label="One fewer stage"
                  disabled={form.interviewStages <= 0}
                  onClick={() => set('interviewStages', form.interviewStages - 1)}
                >
                  <Minus aria-hidden />
                </Button>
                <output
                  id="share-stages"
                  aria-live="polite"
                  className="w-10 text-center text-base font-semibold text-foreground"
                >
                  {form.interviewStages}
                </output>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  aria-label="One more stage"
                  disabled={form.interviewStages >= MAX_STAGES}
                  onClick={() => set('interviewStages', form.interviewStages + 1)}
                >
                  <Plus aria-hidden />
                </Button>
              </div>
            </Field>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium text-foreground">
                Interview formats <span className="font-normal text-muted-foreground">(choose any)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {INTERVIEW_FORMATS.map((format) => {
                  const on = form.interviewFormats.includes(format)
                  return (
                    <button
                      key={format}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        set(
                          'interviewFormats',
                          on ? form.interviewFormats.filter((f) => f !== format) : [...form.interviewFormats, format],
                        )
                      }
                      className={cn(
                        'rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        on ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {LABELS[format]}
                    </button>
                  )
                })}
              </div>
              {errors.interviewFormats && <ErrorText>{errors.interviewFormats}</ErrorText>}
            </fieldset>

            <ChoiceGroup
              legend="Outcome"
              name="outcome"
              large
              options={OUTCOMES.map((v) => ({ value: v, label: LABELS[v] }))}
              value={form.outcome}
              onChange={(v) => set('outcome', v)}
              error={errors.outcome}
            />
          </Section>

          {/* 3. Your story */}
          <Section number={3} title="Your story">
            <p className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <span>
                Don't include names, emails or anything that could identify you or others. Don't share
                confidential interview questions.
              </span>
            </p>
            <StoryField
              id="share-interview"
              label="Interview experience"
              placeholder="What were the stages like? What did they ask about?"
              value={form.interviewExperience}
              onChange={(v) => set('interviewExperience', v)}
              error={errors.interviewExperience}
            />
            <StoryField
              id="share-advice"
              label="Advice for others"
              placeholder="What would you tell someone applying next?"
              value={form.advice}
              onChange={(v) => set('advice', v)}
              error={errors.advice}
            />
            {errors.story && <ErrorText>{errors.story}</ErrorText>}
          </Section>

          {/* 4. Post as */}
          <Section number={4} title="Post as">
            <div role="radiogroup" aria-label="Post as" className="grid gap-3 sm:grid-cols-2">
              <PostAsOption
                checked={!form.showName}
                onSelect={() => set('showName', false)}
                title="Anonymous"
                description="Your name isn't stored on the post. Only you can see that you wrote it."
              />
              <PostAsOption
                checked={form.showName}
                onSelect={() => set('showName', true)}
                title="Show my name"
                description={user?.name ? `Shown as “${user.name}”.` : 'Your account name is shown on the post.'}
              />
            </div>
          </Section>

          {serverError && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {serverError}
            </p>
          )}
          {submitted && !checked.ok && (
            <p className="text-sm text-destructive" role="alert">
              Check the highlighted fields above.
            </p>
          )}

          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button type="button" variant="ghost" size="lg" onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
            )}
            <Button type="submit" size="lg" loading={submitting}>
              {submitLabel}
            </Button>
          </div>
        </form>

        <aside aria-label="Preview" className="lg:sticky lg:top-6 lg:self-start">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Preview</h2>
          <ExperienceCard
            experience={preview}
            company={form.companyId ? companyById.get(form.companyId)?.data : undefined}
            position={form.positionId ? positionById.get(form.positionId)?.data : undefined}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {form.showName && user?.name ? `Shared by ${user.name}` : 'Shared anonymously'} · This is how your post
            will look in lists.
          </p>
        </aside>
    </div>
  )
}

function Section({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`share-section-${number}`} className="flex flex-col gap-5">
      <h2 id={`share-section-${number}`} className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Field({
  label,
  htmlFor,
  error,
  errorId,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  errorId?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </div>
  )
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}

function ErrorText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-xs text-destructive">
      {children}
    </p>
  )
}

function ChoiceGroup({
  legend,
  name,
  options,
  value,
  onChange,
  error,
  optional,
  allowClear,
  large,
}: {
  legend: string
  name: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  error?: string
  optional?: boolean
  allowClear?: boolean
  large?: boolean
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-foreground">
        {legend} {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </legend>
      <div className={cn('grid gap-2', large ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-3 sm:max-w-md')}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              // `relative` anchors the visually-hidden radio inside its option.
              'relative flex cursor-pointer items-center justify-center rounded-lg border text-center text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
              large ? 'min-h-14 px-2 py-3 font-medium' : 'px-3 py-2',
              value === option.value
                ? 'border-primary bg-primary/15 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground',
              error && value !== option.value && 'border-destructive/60',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              aria-invalid={!!error}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
      {allowClear && value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Clear
        </button>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </fieldset>
  )
}

function StoryField({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
}: {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  const length = value.replace(/\r\n?/g, '\n').trim().length
  const over = length > STORY_MAX
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={5}
        value={value}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={`${id}-count`}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex justify-between gap-2">
        {error ? <ErrorText>{error}</ErrorText> : <span />}
        <span id={`${id}-count`} className={cn('text-xs', over ? 'text-destructive' : 'text-muted-foreground')}>
          {length.toLocaleString('en-US')} / {STORY_MAX.toLocaleString('en-US')}
        </span>
      </div>
    </div>
  )
}

function PostAsOption({
  checked,
  onSelect,
  title,
  description,
}: {
  checked: boolean
  onSelect: () => void
  title: string
  description: string
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
        checked ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/50',
      )}
    >
      <span className="flex items-center gap-2 font-medium text-foreground">
        <input type="radio" name="postAs" checked={checked} onChange={onSelect} className="size-4 accent-primary" />
        {title}
      </span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </label>
  )
}
