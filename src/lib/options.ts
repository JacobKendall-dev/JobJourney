/**
 * Choice lists shared by the schemas, the filters and the UI.
 *
 * The schemas use the values as `select` options. The server does NOT reject a
 * value outside these lists (the options describe the column; they aren't a
 * constraint), so anything a member writes directly — company industry,
 * position level and category — can hold an unknown value from a forged
 * request. Always display through `labelFor`, which falls back to "Other".
 * Values written by actions are validated inside the action.
 */

export const INDUSTRIES = ['technology', 'finance', 'healthcare', 'government', 'other'] as const
export type Industry = (typeof INDUSTRIES)[number]

export const LEVELS = ['intern', 'entry', 'mid', 'senior'] as const
export type Level = (typeof LEVELS)[number]

export const CATEGORIES = ['software', 'it', 'cybersecurity', 'data', 'other'] as const
export type Category = (typeof CATEGORIES)[number]

export const OUTCOMES = ['offer', 'rejected', 'ghosted', 'withdrew', 'in_progress'] as const
export type Outcome = (typeof OUTCOMES)[number]

export const INTERVIEW_FORMATS = [
  'phone_screen',
  'online_assessment',
  'technical',
  'behavioral',
  'take_home',
  'final_round',
] as const
export type InterviewFormat = (typeof INTERVIEW_FORMATS)[number]

export const LABELS: Record<string, string> = {
  // industries
  technology: 'Technology',
  finance: 'Finance',
  healthcare: 'Healthcare',
  government: 'Government',
  other: 'Other',
  // levels
  intern: 'Intern',
  entry: 'Entry level',
  mid: 'Mid level',
  senior: 'Senior',
  // categories
  software: 'Software',
  it: 'IT',
  cybersecurity: 'Cybersecurity',
  data: 'Data',
  // outcomes
  offer: 'Offer',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
  withdrew: 'Withdrew',
  in_progress: 'In progress',
  // interview formats
  phone_screen: 'Phone screen',
  online_assessment: 'Online assessment',
  technical: 'Technical',
  behavioral: 'Behavioral',
  take_home: 'Take-home',
  final_round: 'Final round',
}

/** True when `value` is one of `options` — narrows unknown input to the choice type. */
export function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
}

/** Display label for a stored choice, or "Other" for a value outside `options`. */
export function labelFor(options: readonly string[], value: unknown): string {
  return isOneOf(options, value) ? (LABELS[value] ?? value) : 'Other'
}

/**
 * Boolean columns read back as 0 / 1 (the SDK stores them as numbers and only
 * decodes `json` columns on read). Never compare a stored boolean with `=== true`.
 */
export function isTrue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}
