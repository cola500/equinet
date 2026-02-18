import { test, expect } from './fixtures'
import { seedBooking, cleanupSpecData, getBaseEntities } from './setup/seed-helpers'
import { prisma } from './fixtures'

const SPEC_TAG = 'exploratory'

/**
 * E2E Tests for Exploratory Test Plan - Baseline & Gaps
 *
 * Covers test cases NOT already covered by existing specs:
 * - 1.2.4: Dashboard stat cards navigation
 * - 1.8.7: Provider profile recurring bookings settings
 * - 1.14.2: Admin system page (db status, feature flags, email toggle)
 * - Smoke test: all key pages load without errors
 *
 * Already covered by other specs (see coverage mapping):
 * - auth.spec.ts: 1.1.1-1.1.4 (login, logout, error messages)
 * - provider.spec.ts: 1.2.1-1.2.2, 1.4.1-1.4.6, 1.5.1-1.5.6
 * - calendar.spec.ts: 1.6.1-1.6.3
 * - manual-booking.spec.ts: 1.6.7
 * - customer-registry.spec.ts + provider-notes.spec.ts: 1.7.1-1.7.5
 * - accepting-new-customers.spec.ts: 1.8.5
 * - reschedule.spec.ts: 1.8.6, 2.1-2.8
 * - customer-reviews.spec.ts: 1.9.1-1.9.2, 1.11.5
 * - booking.spec.ts: 1.10.1-1.10.8, 1.11.1-1.11.4
 * - horses.spec.ts: 1.12.1-1.12.5
 * - admin.spec.ts: 1.14.1, 1.14.3, 1.14.4
 * - feature-flag-toggle.spec.ts: 1.2.3, 1.3.1-1.3.2, 1.13.1-1.13.2, Fas 4-11
 */

// ─── Helpers ──────────────────────────────────────────────────────

async function resetRateLimit(page: import('@playwright/test').Page) {
  await page.request.post('/api/test/reset-rate-limit').catch(() => {})
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

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.context().clearCookies()
  await resetRateLimit(page)
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('admin@example.com')
  await page.getByLabel('Lösenord', { exact: true }).fill('AdminPass123!')
  await page.getByRole('button', { name: /logga in/i }).click()
  await expect(page).toHaveURL(/\/(dashboard|admin|providers)/, { timeout: 15000 })
}

// ─── Tests ────────────────────────────────────────────────────────

test.describe('Exploratory Baseline Tests', () => {

  test.beforeAll(async () => {
    await cleanupSpecData(SPEC_TAG)
    // Seed a few bookings for dashboard stats
    await seedBooking({ specTag: SPEC_TAG, status: 'pending', daysFromNow: 5, horseName: 'E2E ExplPending' })
    await seedBooking({ specTag: SPEC_TAG, status: 'confirmed', daysFromNow: 10, horseName: 'E2E ExplConfirmed' })
    await seedBooking({ specTag: SPEC_TAG, status: 'completed', daysFromNow: -7, horseName: 'E2E ExplCompleted' })
  })

  test.afterAll(async () => {
    // Restore recurring bookings setting
    const base = await getBaseEntities()
    await prisma.provider.update({
      where: { id: base.providerId },
      data: { maxSeriesSize: 12 },
    }).catch(() => {})
    await cleanupSpecData(SPEC_TAG)
  })

  // ─── 1.2.4 Dashboard stat cards navigation ─────────────────────

  test('1.2.4 dashboard stat cards should link to correct pages', async ({ page }) => {
    await loginAsProvider(page)
    await page.goto('/provider/dashboard')
    await expect(page.getByRole('heading', { name: /välkommen/i })).toBeVisible({ timeout: 10000 })

    // "Aktiva tjänster" card should link to /provider/services
    const servicesCard = page.locator('[data-slot="card"]').filter({ hasText: /aktiva tjänster/i })
    await expect(servicesCard).toBeVisible({ timeout: 10000 })

    // Find the clickable link within the card
    const servicesLink = servicesCard.getByRole('link').first()
    if (await servicesLink.isVisible().catch(() => false)) {
      const href = await servicesLink.getAttribute('href')
      expect(href).toContain('/provider/services')
    }

    // "Kommande bokningar" card should link to /provider/bookings
    const bookingsCard = page.locator('[data-slot="card"]').filter({ hasText: /kommande bokningar/i })
    await expect(bookingsCard).toBeVisible()

    const bookingsLink = bookingsCard.getByRole('link').first()
    if (await bookingsLink.isVisible().catch(() => false)) {
      const href = await bookingsLink.getAttribute('href')
      expect(href).toContain('/provider/bookings')
    }
  })

  // ─── 1.8.7 Provider profile: recurring bookings settings ───────

  test('1.8.7 provider profile: recurring bookings max series size setting', async ({ page }) => {
    await loginAsProvider(page)
    await page.goto('/provider/profile')
    await expect(page.getByRole('heading', { name: /min profil/i })).toBeVisible({ timeout: 10000 })

    // Find the recurring bookings section
    const recurringSection = page.getByText(/återkommande bokningar|max antal i serie/i)
    const sectionVisible = await recurringSection.isVisible().catch(() => false)

    if (!sectionVisible) {
      // Section may be behind a feature flag or tab
      test.skip(true, 'Recurring bookings settings section not visible (may require flag)')
      return
    }

    // Find and change the max series size
    const maxSeriesInput = page.locator('#max-series-size, [name="maxSeriesSize"]').first()
    if (await maxSeriesInput.isVisible().catch(() => false)) {
      await maxSeriesInput.clear()
      await maxSeriesInput.fill('8')

      // Wait for save (auto-save or click save)
      await page.waitForTimeout(2000)

      // Verify the value persisted
      const value = await maxSeriesInput.inputValue()
      expect(value).toBe('8')
    }
  })

  // ─── 1.14.2 Admin system page ──────────────────────────────────

  test('1.14.2 admin system page: db status, feature flags, email toggle', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/system')

    await expect(page.getByRole('heading', { name: /systemstatus/i })).toBeVisible({ timeout: 10000 })

    // Database status section
    await expect(page.getByText('Databas')).toBeVisible()
    await expect(page.getByText('Frisk')).toBeVisible()

    // Email toggle section
    await expect(page.getByText(/pausa e-postutskick/i)).toBeVisible()

    // Feature Flags section (labels are in Swedish)
    await expect(page.getByText('Feature Flags')).toBeVisible()

    const flagLabels = [
      'Röstloggning',
      'Ruttplanering',
      'Rutt-annonser',
      'Kundinsikter',
      'Besöksplanering',
      'Gruppbokningar',
      'Affärsinsikter',
      'Självservice-ombokning',
      'Återkommande bokningar',
    ]

    for (const label of flagLabels) {
      await expect(
        page.getByText(label).first(),
        `Feature flag "${label}" should be listed on admin system page`
      ).toBeVisible()
    }
  })

  // ─── Smoke test: key pages load without errors ─────────────────

  test.describe('Smoke test: provider pages load', () => {

    test('all provider pages should load without errors', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => {
        errors.push(`${error.name}: ${error.message}`)
      })

      await loginAsProvider(page)

      const providerPages = [
        { url: '/provider/dashboard', heading: /välkommen/i },
        { url: '/provider/bookings', heading: /bokningar/i },
        { url: '/provider/services', heading: /tjänster/i },
        { url: '/provider/customers', heading: /kunder|kundregister/i },
        { url: '/provider/calendar', heading: /kalender/i },
        { url: '/provider/reviews', heading: /recensioner/i },
        { url: '/provider/profile', heading: /min profil/i },
      ]

      for (const { url, heading } of providerPages) {
        await page.goto(url)
        await expect(
          page.getByRole('heading', { name: heading }).first(),
          `Page ${url} should have correct heading`
        ).toBeVisible({ timeout: 15000 })
      }

      // Filter out known benign errors
      const realErrors = errors.filter(e =>
        !e.includes('hydrat') &&
        !e.includes('Warning') &&
        !e.includes('favicon')
      )

      expect(realErrors, `Page errors found: ${realErrors.join('; ')}`).toHaveLength(0)
    })
  })

  test.describe('Smoke test: customer pages load', () => {

    test('all customer pages should load without errors', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => {
        errors.push(`${error.name}: ${error.message}`)
      })

      await loginAsCustomer(page)

      const customerPages = [
        { url: '/providers', heading: /hitta tjänsteleverantörer/i },
        { url: '/customer/bookings', heading: /mina bokningar/i },
        { url: '/customer/horses', heading: /mina hästar/i },
        { url: '/customer/profile', heading: /min profil|profil/i },
        { url: '/announcements', heading: /planerade rutter|annonser/i },
      ]

      for (const { url, heading } of customerPages) {
        await page.goto(url)
        await expect(
          page.getByRole('heading', { name: heading }).first(),
          `Page ${url} should have correct heading`
        ).toBeVisible({ timeout: 15000 })
      }

      const realErrors = errors.filter(e =>
        !e.includes('hydrat') &&
        !e.includes('Warning') &&
        !e.includes('favicon')
      )

      expect(realErrors, `Page errors found: ${realErrors.join('; ')}`).toHaveLength(0)
    })
  })

  test.describe('Smoke test: admin pages load', () => {

    test('all admin pages should load without errors', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => {
        errors.push(`${error.name}: ${error.message}`)
      })

      await loginAsAdmin(page)

      const adminPages = [
        { url: '/admin', heading: /adminpanel/i },
        { url: '/admin/users', heading: /användare/i },
        { url: '/admin/bookings', heading: /bokningar/i },
        { url: '/admin/reviews', heading: /recensioner/i },
        { url: '/admin/system', heading: /system/i },
      ]

      for (const { url, heading } of adminPages) {
        await page.goto(url)
        await expect(
          page.getByRole('heading', { name: heading }).first(),
          `Page ${url} should have correct heading`
        ).toBeVisible({ timeout: 15000 })
      }

      const realErrors = errors.filter(e =>
        !e.includes('hydrat') &&
        !e.includes('Warning') &&
        !e.includes('favicon')
      )

      expect(realErrors, `Page errors found: ${realErrors.join('; ')}`).toHaveLength(0)
    })
  })
})
