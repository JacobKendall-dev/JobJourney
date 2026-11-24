/**
 * Navigation Config
 *
 * Add one entry per nav item. Routes are handled by generouted
 * (file-based routing in src/pages/), this just controls what
 * appears in the navigation bar. The account menu (My posts, Bookmarks,
 * Admin) lives in src/components/Navigation.tsx.
 */

import type { Role } from './constants'

export interface NavItem {
  path: string
  label: string
  roles?: Role[]
  devOnly?: boolean
}

export const nav: NavItem[] = [
  { path: '/experiences', label: 'Browse' },
  { path: '/companies', label: 'Companies' },
  // ── Features add nav items below this line ──
]
