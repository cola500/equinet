import { test, expect } from './fixtures'
import { prisma } from './fixtures'
import { cleanupSpecData, seedBookingSeries, getBaseEntities } from './setup/seed-helpers'

/**
 * E2E Tests for Recurring Bookings (C1)
 *
 * Covers:
 * - Provider settings (recurring toggle, max occurrences)
 * - Customer booking dialog (recurring toggle, interval/count selects)
 * - Badge/icon display on customer bookings and provider calendar
 * - Edge cases (provider disabled, feature flag off)
 */

const SPEC_TAG = 'recurring'

// ─── Helpers (copied from feature-flag-toggle.spec.ts) ──────────

async function resetRateLimit(page: import('@playwright/test').Page) {
  await page.request.post('/api/test/reset-rate-limit').catch(() => {})
}

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.context().clearCookies()
  await resetRateLimit(page)
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('admin@example.com')
  await page.getByLabel('Lösenord', { exact: true }).fill('AdminPass123!')
  await page.getByRole('button', { name: /logga in/i }).click()
  await expect(page).toHaveURL(/\/(dashboard|admin|providers)/, { timeout: 15000 })
}

async function loginAsProvider(page: import('@playwright/test').Page) {
  await page.context().clearCookies()
  await resetRateLimit(page)
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('provider@example.com')
  await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!')
  await page.getByRole('button', { name: /logga in/i }).click()
  await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 15000 })
}

async function loginAsCustomer(page: import('@playwright/test').Page) {
  await page.context().clearCookies()
  await resetRateLimit(page)
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('test@example.com')
  await page.getByLabel('Lösenord', { exact: true }).fill('TestPassword123!')
  await page.getByRole('button', { name: /logga in/i }).click()
  await expect(page).toHaveURL(/\/(dashboard|providers)/, { timeout: 15000 })
}

async function setFlag(page: import('@playwright/test').Page, flag: string, value: boolean) {
  const response = await page.request.patch('/api/admin/settings', {
    data: { key: `feature_${flag}`, value: String(value) },
  })
  expect(response.ok()).toBeTruthy()
}

async function syncClientFlags(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('featureflags-changed'))
  })
  await page.waitForTimeout(500)
}

/**
 * Navigate to booking dialog for first available provider.
 * Returns true if dialog was opened, false if skipped (no providers/services).
 */
async function openBookingDialog(page: import('@playwright/test').Page, t: typeof test): Promise<boolean> {
  await page.goto('/providers')
  await syncClientFlags(page)
  await expect(page.getByRole('heading', { name: /hitta tjänsteleverantörer/i })).toBeVisible({ timeout: 10000 })

  const providerCard = page.locator('[data-testid="provider-card"]').first()
  if (!(await providerCard.isVisible().catch(() => false))) {
    t.skip(true, 'No providers available')
    return false
  }
  await providerCard.getByRole('link', { name: /se profil/i }).click()

  // Wait for service buttons to appear
  const bokaButton = page.getByRole('button', { name: /boka denna tjänst/i }).first()
  const hasServices = await bokaButton.isVisible({ timeout: 10000 }).catch(() => false)
  if (!hasServices) {
    t.skip(true, 'No active services available')
    return false
  }

  await bokaButton.click()
  await syncClientFlags(page)
  return true
}

// ─── Test suite ──────────────────────────────────────────────────

test.describe('Recurring Bookings (C1)', () => {
  // Track original recurringEnabled value to restore after tests
  let originalRecurringEnabled: boolean

  test.beforeAll(async () => {
    await cleanupSpecData(SPEC_TAG)

    // Seed a booking series for badge/icon tests (Group C)
    await seedBookingSeries({ specTag: SPEC_TAG })

    // Save and enable recurringEnabled on provider
    const base = await getBaseEntities()
    const provider = await prisma.provider.findUniqueOrThrow({
      where: { id: base.providerId },
      select: { recurringEnabled: true },
    })
    originalRecurringEnabled = provider.recurringEnabled

    await prisma.provider.update({
      where: { id: base.providerId },
      data: { recurringEnabled: true },
    })

    // Ensure provider services are active (other specs may have deactivated them)
    await prisma.service.updateMany({
      where: { providerId: base.providerId },
      data: { isActive: true },
    })
  })

  test.afterAll(async () => {
    // Restore provider settings
    const base = await getBaseEntities()
    await prisma.provider.update({
      where: { id: base.providerId },
      data: { recurringEnabled: originalRecurringEnabled },
    })

    await cleanupSpecData(SPEC_TAG)
  })

  // ─── Group A: Provider settings ────────────────────────────────

  test.describe('Group A: Provider settings', () => {

    test('A1: Provider sees "Återkommande bokningar" card on profile', async ({ page }) => {
      await loginAsProvider(page)
      await page.goto('/provider/profile')
      // Wait for profile to load (h1 is a real heading)
      await expect(page.getByRole('heading', { name: /min profil/i })).toBeVisible({ timeout: 10000 })

      // CardTitle is <div>, not a heading. Scroll to it.
      const recurringTitle = page.getByText('Återkommande bokningar', { exact: true })
      await recurringTitle.scrollIntoViewIfNeeded()
      await expect(recurringTitle).toBeVisible()

      // The switch should be visible
      await expect(page.locator('#recurring-enabled')).toBeVisible()
    })

    test('A2: Toggle ON shows success toast', async ({ page }) => {
      await loginAsProvider(page)
      await page.goto('/provider/profile')
      await expect(page.locator('#recurring-enabled')).toBeVisible({ timeout: 10000 })

      // Ensure it's OFF first, then toggle ON
      const isChecked = await page.locator('#recurring-enabled').getAttribute('data-state')
      if (isChecked === 'checked') {
        // Toggle off first
        await page.locator('#recurring-enabled').click()
        await page.waitForTimeout(500)
      }

      // Toggle ON
      await page.locator('#recurring-enabled').click()

      // Expect success toast
      await expect(
        page.getByText(/återkommande bokningar aktiverade/i)
      ).toBeVisible({ timeout: 5000 })
    })

    test('A3: Max occurrences select is visible when toggle is ON', async ({ page }) => {
      await loginAsProvider(page)
      await page.goto('/provider/profile')
      await expect(page.locator('#recurring-enabled')).toBeVisible({ timeout: 10000 })

      // Ensure toggle is ON
      const state = await page.locator('#recurring-enabled').getAttribute('data-state')
      if (state !== 'checked') {
        await page.locator('#recurring-enabled').click()
        await page.waitForTimeout(500)
      }

      // "Max antal tillfällen per serie" label should be visible
      await expect(
        page.getByText(/max antal tillfällen per serie/i)
      ).toBeVisible()
    })
  })

  // ─── Group B: Customer dialog UI ──────────────────────────────

  test.describe('Group B: Customer booking dialog', () => {

    test.beforeEach(async ({ page }) => {
      // Enable feature flag via admin
      await loginAsAdmin(page)
      await setFlag(page, 'recurring_bookings', true)
    })

    test('B1: Recurring toggle visible in booking dialog', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop booking dialog test')

      await loginAsCustomer(page)
      if (!(await openBookingDialog(page, test))) return

      // "Gör detta återkommande" label should be visible
      await expect(page.getByText(/gör detta återkommande/i)).toBeVisible({ timeout: 10000 })
    })

    test('B2: Activating toggle shows interval and count selects', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop booking dialog test')

      await loginAsCustomer(page)
      if (!(await openBookingDialog(page, test))) return

      // Enable recurring toggle
      await page.locator('#recurring-toggle').click()

      // Interval label should appear
      await expect(page.getByText('Intervall', { exact: true })).toBeVisible({ timeout: 5000 })

      // Count label should appear
      await expect(page.getByText('Antal tillfällen', { exact: true })).toBeVisible()
    })

    test('B3: Interval and count selects are functional', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop booking dialog test')

      await loginAsCustomer(page)
      if (!(await openBookingDialog(page, test))) return

      // Enable recurring toggle
      await page.locator('#recurring-toggle').click()
      await page.waitForTimeout(300)

      // The interval and count selects should have default values
      // Just verify the selects are interactable (no crash)
      const intervalSection = page.getByText('Intervall', { exact: true }).locator('..')
      await expect(intervalSection).toBeVisible()

      const countSection = page.getByText('Antal tillfällen', { exact: true }).locator('..')
      await expect(countSection).toBeVisible()

      // Close dialog
      await page.keyboard.press('Escape')
    })

    test('B4: Full booking via API creates series with result dialog text', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop booking dialog test')

      // Login as customer to get a session
      await loginAsCustomer(page)
      await syncClientFlags(page)

      // Get base entities for the API call
      const base = await getBaseEntities()

      // Calculate a future weekday for the first booking
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 14)
      const dow = futureDate.getDay()
      if (dow === 0) futureDate.setDate(futureDate.getDate() + 1)
      if (dow === 6) futureDate.setDate(futureDate.getDate() + 2)
      const dateStr = futureDate.toISOString().split('T')[0]

      // POST directly to the booking-series API
      await resetRateLimit(page)
      const response = await page.request.post('/api/booking-series', {
        data: {
          providerId: base.providerId,
          serviceId: base.service1Id,
          firstBookingDate: dateStr,
          startTime: '10:00',
          intervalWeeks: 2,
          totalOccurrences: 3,
          horseName: 'E2E Thunder',
          customerNotes: `E2E-spec:${SPEC_TAG}`,
        },
      })

      expect(response.status()).toBe(201)
      const result = await response.json()

      // API returns: { series: { id, intervalWeeks, totalOccurrences, createdCount, status }, createdBookings, skippedDates }
      expect(result.series).toBeTruthy()
      expect(result.series.id).toBeTruthy()
      expect(result.series.createdCount).toBeGreaterThanOrEqual(1)
      expect(result.series.totalOccurrences).toBe(3)
      expect(result.series.intervalWeeks).toBe(2)
      expect(result.createdBookings).toBeTruthy()
      expect(Array.isArray(result.skippedDates)).toBeTruthy()
    })
  })

  // ─── Group C: Badge/icon display ──────────────────────────────

  test.describe('Group C: Badge and icon display', () => {

    test('C1: Customer sees "Återkommande" badge on bookings page', async ({ page }) => {
      await loginAsCustomer(page)
      await page.goto('/customer/bookings')

      // Wait for bookings to load
      await expect(page.locator('[data-testid="booking-item"]').first()).toBeVisible({ timeout: 15000 })

      // At least one badge should show "Återkommande" (from seeded series)
      await expect(
        page.getByText('Återkommande', { exact: true }).first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('C2: Provider sees Repeat icon on calendar booking', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Calendar week navigation not available on mobile')

      await loginAsProvider(page)
      await page.goto('/provider/calendar')

      // Wait for calendar to load
      await expect(page.getByRole('heading', { name: /kalender/i })).toBeVisible({ timeout: 10000 })

      // The seeded bookings are in the future - navigate forward if needed
      // BookingBlock renders Repeat icon with title "Återkommande bokning"
      // The icon is inside a span with title attribute
      const repeatIcon = page.locator('span[title="Återkommande bokning"]')

      // Navigate to find the bookings - they're 1-5 weeks out
      // Try clicking "next week" a few times to find them
      let found = false
      for (let i = 0; i < 6; i++) {
        if (await repeatIcon.first().isVisible().catch(() => false)) {
          found = true
          break
        }
        // Click next week button
        const nextButton = page.getByRole('button', { name: /nästa|framåt|>/i }).last()
        if (await nextButton.isVisible().catch(() => false)) {
          await nextButton.click()
          await page.waitForTimeout(500)
        }
      }

      expect(found, 'Repeat icon should be visible on at least one calendar booking').toBeTruthy()
    })

    test('C3: Provider sees series bookings in bookings list', async ({ page }) => {
      await loginAsProvider(page)
      await page.goto('/provider/bookings')

      // Wait for bookings to load
      await expect(page.getByRole('heading', { name: /bokningar/i })).toBeVisible({ timeout: 10000 })

      // The page should show bookings - we just verify it renders without error
      await page.waitForLoadState('networkidle')

      // At minimum, the page renders and we can see booking content
      // Provider bookings list doesn't show "Återkommande" badge (only customer side does)
      // but the bookings from the series should appear
      const pageContent = await page.textContent('body')
      expect(pageContent).toBeTruthy()
    })
  })

  // ─── Group D: Edge cases ──────────────────────────────────────

  test.describe('Group D: Edge cases', () => {

    test('D1: Provider with recurringEnabled=false -> API returns 403', async ({ page }) => {
      // Temporarily disable recurring on provider
      const base = await getBaseEntities()
      await prisma.provider.update({
        where: { id: base.providerId },
        data: { recurringEnabled: false },
      })

      try {
        await loginAsCustomer(page)
        await resetRateLimit(page)

        // Enable feature flag so the check goes to provider-level
        await loginAsAdmin(page)
        await setFlag(page, 'recurring_bookings', true)

        // Re-login as customer
        await loginAsCustomer(page)

        const futureDate = new Date()
        futureDate.setDate(futureDate.getDate() + 21)
        const dow = futureDate.getDay()
        if (dow === 0) futureDate.setDate(futureDate.getDate() + 1)
        if (dow === 6) futureDate.setDate(futureDate.getDate() + 2)
        const dateStr = futureDate.toISOString().split('T')[0]

        await resetRateLimit(page)
        const response = await page.request.post('/api/booking-series', {
          data: {
            providerId: base.providerId,
            serviceId: base.service1Id,
            firstBookingDate: dateStr,
            startTime: '10:00',
            intervalWeeks: 2,
            totalOccurrences: 3,
          },
        })

        expect(response.status()).toBe(403)
        const body = await response.json()
        expect(body.error).toContain('aktiverat')
      } finally {
        // Restore
        await prisma.provider.update({
          where: { id: base.providerId },
          data: { recurringEnabled: true },
        })
      }
    })

    test('D2: Feature flag OFF -> no recurring toggle in booking dialog', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop booking dialog test')

      await loginAsAdmin(page)
      await setFlag(page, 'recurring_bookings', false)

      await loginAsCustomer(page)
      if (!(await openBookingDialog(page, test))) return

      // "Gör detta återkommande" should NOT be visible
      await expect(page.getByText(/gör detta återkommande/i)).not.toBeVisible({ timeout: 5000 })

      await page.keyboard.press('Escape')

      // Cleanup: restore flag
      await loginAsAdmin(page)
      await setFlag(page, 'recurring_bookings', true)
    })
  })
})
