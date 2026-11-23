/** Position helpers for the add-position form. The server enforces lengths and uniqueness too. */

import { CATEGORIES, LEVELS, isOneOf, type Category, type Level } from './options'

export const POSITION_TITLE_MAX = 100

export interface NewPositionInput {
  title: string
  level: string
  category: string
}

export interface NewPositionFields {
  title: string
  level: Level
  category: Category
}

export type NewPositionResult =
  | { ok: true; fields: NewPositionFields }
  | { ok: false; errors: Partial<Record<keyof NewPositionInput, string>> }

export function validateNewPosition(input: NewPositionInput): NewPositionResult {
  const errors: Partial<Record<keyof NewPositionInput, string>> = {}
  // Collapse spaces: uniqueOn compares exact text, so "Data  Intern" and
  // "Data Intern" would otherwise both be allowed.
  const title = input.title.trim().replace(/\s+/g, ' ')
  if (title.length < 2) errors.title = 'Enter the job title.'
  else if (title.length > POSITION_TITLE_MAX) errors.title = `Use ${POSITION_TITLE_MAX} characters or fewer.`
  if (!isOneOf(LEVELS, input.level)) errors.level = 'Choose a level.'
  if (!isOneOf(CATEGORIES, input.category)) errors.category = 'Choose a category.'
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, fields: { title, level: input.level as Level, category: input.category as Category } }
}
