import { test, expect, type Page } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

/**
 * Loading, empty, not-found and mobile states, signed out, at phone and
 * desktop widths. Written to pass whether or not sample data is loaded.
 *
 * Set SHOTS_DIR to also save a full-page screenshot of each page.
 */

const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
]

const PAGES = [
  { path: '/', ready: '[data-testid="static-landing"]' },
  { path: '/experiences', ready: 'h1:has-text("Browse experiences")' },
  { path: '/companies', ready: 'h1:has-text("Companies")' },
  { path: '/experiences/does-not-exist', ready: 'text=This experience doesn\'t exist or was deleted.' },
  { path: '/companies/does-not-exist', ready: 'text=We don\'t have a company at this address.' },
  { path: '/experiences/new', ready: 'text=Sign in to continue' },
  { path: '/me', ready: 'text=Sign in to continue' },
  { path: '/bookmarks', ready: 'text=Sign in to continue' },
  { path: '/admin', ready: 'text=Sign in to continue' },
  { path: '/no-such-page', ready: 'text=404' },
]

/** True when the page is wider than the window (sideways scrolling). */
async function overflowsSideways(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
}

/** Wait until skeletons are gone, so the settled state is what's checked. */
async function settle(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15000 })
}

for (const size of WIDTHS) {
  test.describe(`${size.name} (${size.width}px)`, () => {
    test.use({ viewport: { width: size.width, height: size.height } })

    for (const { path, ready } of PAGES) {
      test(`${path} settles with no sideways scroll`, async ({ page }) => {
        const errors = captureConsoleErrors(page)
        await page.goto(path)
        await expect(page.locator(ready).first()).toBeVisible({ timeout: 15000 })
        await settle(page)
        expect(await overflowsSideways(page)).toBe(false)
        if (process.env.SHOTS_DIR) {
          const name = `${size.name}${path.replace(/[^a-z0-9]+/gi, '_') || '_home'}.png`
          await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}`, fullPage: true })
        }
        expect(errors).toEqual([])
      })
    }
  })
}

test.describe('Browse states', () => {
  test('shows results or the empty state, never a blank list', async ({ page }) => {
    await page.goto('/experiences')
    await settle(page)
    const cards = page.locator('a[href^="/experiences/"]:not([href="/experiences/new"])')
    const empty = page.getByText(/No experiences (match these filters|yet)/)
    await expect(cards.first().or(empty.first())).toBeVisible()
  })

  test('filters that match nothing show the empty state with Clear filters', async ({ page }) => {
    await page.goto('/experiences?q=zzzz-no-such-company-zzzz')
    await settle(page)
    await expect(page.getByText('No experiences match these filters yet.')).toBeVisible()
    await expect(page.getByRole('button', { name: /clear filters/i }).or(page.getByRole('link', { name: /clear filters/i })).first()).toBeVisible()
  })

  test('on a phone the filters fold behind a Filters button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/experiences')
    await settle(page)
    const toggle = page.getByRole('button', { name: /^Filters/ })
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(await overflowsSideways(page)).toBe(false)
  })

  test('on desktop the filters show without a toggle', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/experiences')
    await settle(page)
    await expect(page.getByRole('button', { name: /^Filters/ })).toBeHidden()
  })
})

test('the phone menu opens and lists the main pages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/experiences')
  await page.getByRole('button', { name: /menu/i }).click()
  await expect(page.getByRole('link', { name: 'Companies' }).last()).toBeVisible()
  expect(await overflowsSideways(page)).toBe(false)
})
