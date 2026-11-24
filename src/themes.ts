/**
 * Theme catalog. JobJourney ships one theme, `trail`, defined in
 * src/themes.css and set on <html> in index.html. `slate` is the base token
 * set in styles.css that every theme overrides; it isn't used on its own.
 *
 * Color values live in styles.css / themes.css — this file is metadata only.
 */

export const THEMES = [
  {
    id: 'trail',
    label: 'Trail',
    description: "JobJourney's theme: light green-tinted surface, ink text, evergreen accent.",
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Base dark token set from the scaffold. Not used on its own.',
  },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

/** Read the currently active theme id from <html data-theme>. */
export function getActiveTheme(): ThemeId {
  if (typeof document === 'undefined') return 'slate'
  const id = document.documentElement.getAttribute('data-theme') as ThemeId | null
  return id ?? 'slate'
}

/** Look up a theme entry by id, or fall back to the first theme. */
export function getTheme(id: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
