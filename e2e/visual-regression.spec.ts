/**
 * Visual Regression Tests
 *
 * Captures baseline screenshots of key pages and detects visual regressions.
 * Uses Playwright's built-in toHaveScreenshot() with dynamic content masking.
 *
 * Generate baselines: npm run test:e2e:update-snapshots
 * Run checks:         npm run test:e2e:visual
 */
import { test } from './fixtures'
import { seedBooking, cleanupSpecData } from './setup/seed-helpers'
import {
  loginAsProvider,
  loginAsCustomer,
  takeStableScreenshot,
} from './setup/visual-helpers'

const SPEC_TAG = 'visual'

test.describe('Visual Regression', () => {
  test.beforeAll(async () => {
    await cleanupSpecData(SPEC_TAG)
    // Seed bookings in different states for realistic screenshots
    await seedBooking({ specTag: SPEC_TAG, status: 'pending', daysFromNow: 3, horseName: 'E2E VisPending' })
    await seedBooking({ specTag: SPEC_TAG, status: 'confirmed', daysFromNow: 7, horseName: 'E2E VisConfirmed' })
    await seedBooking({ specTag: SPEC_TAG, status: 'completed', daysFromNow: -5, horseName: 'E2E VisCompleted' })
  })

  test.afterAll(async () => {
    await cleanupSpecData(SPEC_TAG)
  })

  // ─── Public pages ───────────────────────────────────────────────

  test('landing-page', async ({ page }) => {
    await page.goto('/')
    await takeStableScreenshot(page, 'landing-page.png')
  })

  test('login-page', async ({ page }) => {
    await page.goto('/login')
    await takeStableScreenshot(page, 'login-page.png')
  })

  // ─── Provider pages ─────────────────────────────────────────────

  test.describe('Provider pages', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsProvider(page)
    })

    test('provider-dashboard', async ({ page }) => {
      await page.goto('/provider/dashboard')
      await page.getByRole('heading', { name: /välkommen/i }).waitFor({ timeout: 10000 })
      await takeStableScreenshot(page, 'provider-dashboard.png')
    })

    test('provider-bookings', async ({ page }) => {
      await page.goto('/provider/bookings')
      await page.getByRole('heading', { name: 'Bokningar', exact: true }).waitFor({ timeout: 10000 })
      await takeStableScreenshot(page, 'provider-bookings.png')
    })

    test('provider-calendar', async ({ page }) => {
      await page.goto('/provider/calendar')
      await page.getByRole('heading', { name: /kalender/i }).waitFor({ timeout: 10000 })
      await takeStableScreenshot(page, 'provider-calendar.png', {
        extraMasks: [
          // Now-line indicator moves with time
          page.locator('[class*="now-line"], [data-testid="now-line"]'),
        ],
        // Calendar has more inherent rendering variation
        maxDiffPixelRatio: 0.02,
      })
    })

    test('provider-customers', async ({ page }) => {
      await page.goto('/provider/customers')
      await page.getByRole('heading', { name: /kunder|kundregister/i }).waitFor({ timeout: 10000 })
      await takeStableScreenshot(page, 'provider-customers.png')
    })

    test('provider-services', async ({ page }) => {
      await page.goto('/provider/services')
      await page.getByRole('heading', { name: /mina tjänster/i }).waitFor({ timeout: 10000 })
      await takeStableScreenshot(page, 'provider-services.png')
    })

    test('provider-profile', async ({ page }) => {
      await page.goto('/provider/profile')
      await page.getByRole('heading', { name: /min profil/i }).waitFor({ timeout: 10000 })
      await takeStableScreenshot(page, 'provider-profile.png', {
        extraMasks: [
          page.locator('img[alt*="avatar" i], img[alt*="profil" i], .avatar'),
        ],
      })
    })
  })

  // ─── Customer pages ─────────────────────────────────────────────

  test.describe('Customer pages', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsCustomer(page)
    })

    test('customer-dashboard', async ({ page }) => {
      await page.goto('/providers')
      await page.getByRole('heading', { name: /hitta tjänsteleverantörer/i }).waitFor({ timeout: 10000 })
      await takeStableScreenshot(page, 'customer-dashboard.png')
    })

    test('customer-bookings', async ({ page }) => {
      await page.goto('/customer/bookings')
      await page.getByRole('heading', { name: /mina bokningar/i }).waitFor({ timeout: 10000 })
      await takeStableScreenshot(page, 'customer-bookings.png')
    })

    test('customer-horses', async ({ page }) => {
      await page.goto('/customer/horses')
      await page.getByRole('heading', { name: /mina hästar/i }).waitFor({ timeout: 10000 })
      await takeStableScreenshot(page, 'customer-horses.png')
    })
  })
})
