/**
 * Visual regression test helpers.
 *
 * Shared login functions, page stabilization, and dynamic content masking
 * for use with Playwright's toHaveScreenshot().
 */
import { expect, type Page, type Locator } from '@playwright/test'

// ─── Login helpers ──────────────────────────────────────────────────

async function resetRateLimit(page: Page) {
  await page.request.post('/api/test/reset-rate-limit').catch(() => {})
}

export async function loginAsProvider(page: Page) {
  await page.context().clearCookies()
  await resetRateLimit(page)
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('provider@example.com')
  await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!')
  await page.getByRole('button', { name: /logga in/i }).click()
  await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 15000 })
}

export async function loginAsCustomer(page: Page) {
  await page.context().clearCookies()
  await resetRateLimit(page)
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('test@example.com')
  await page.getByLabel('Lösenord', { exact: true }).fill('TestPassword123!')
  await page.getByRole('button', { name: /logga in/i }).click()
  await expect(page).toHaveURL(/\/(dashboard|providers)/, { timeout: 15000 })
}

// ─── Page stabilization ─────────────────────────────────────────────

/**
 * Wait for the page to reach a visually stable state:
 * 1. All fonts loaded
 * 2. No pending network requests (2s idle)
 * 3. 300ms settle time for CSS transitions
 */
export async function waitForPageStable(page: Page) {
  // Wait for fonts
  await page.evaluate(() => document.fonts.ready)

  // Wait for network idle (max 2s)
  await page.waitForLoadState('networkidle').catch(() => {})

  // Settle time for CSS transitions
  await page.waitForTimeout(300)
}

// ─── Dynamic content masking ────────────────────────────────────────

/**
 * Returns locators for commonly dynamic content that should be masked
 * in visual regression screenshots to prevent false positives.
 */
export function getCommonMasks(page: Page): Locator[] {
  return [
    // Relative time texts ("2 timmar sedan", "om 3 dagar")
    page.locator('time'),
    // Stat card numbers (badges, counts)
    page.locator('[data-slot="card"] .text-2xl, [data-slot="card"] .text-3xl'),
    // Avatar images (may load differently)
    page.locator('img[alt*="avatar" i], img[alt*="profil" i]'),
    // Toast notifications
    page.locator('[data-sonner-toaster]'),
    // Date displays in headings
    page.locator('.text-muted-foreground:has-text("202")'),
  ]
}

/**
 * Take a stable screenshot with common masks applied.
 *
 * Waits for page stability, combines common masks with any extra masks,
 * then asserts the screenshot matches the baseline.
 */
export async function takeStableScreenshot(
  page: Page,
  name: string,
  options?: {
    extraMasks?: Locator[]
    maxDiffPixelRatio?: number
  }
) {
  await waitForPageStable(page)

  const masks = [
    ...getCommonMasks(page),
    ...(options?.extraMasks ?? []),
  ]

  await expect(page).toHaveScreenshot(name, {
    mask: masks,
    ...(options?.maxDiffPixelRatio !== undefined
      ? { maxDiffPixelRatio: options.maxDiffPixelRatio }
      : {}),
  })
}
