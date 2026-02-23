import { test, expect } from './fixtures'
import {
  getBaseEntities,
  seedBooking,
  cleanupSpecData,
  cleanupCustomerIntervals,
} from './setup/seed-helpers'

/**
 * E2E Tests for Customer Due For Service feature.
 *
 * Covers:
 * - Overdue badge on horse list page
 * - Interval tab visible on horse detail page
 * - Create / update / delete service intervals
 *
 * Feature flag FEATURE_DUE_FOR_SERVICE=true is required (set in .env + playwright.config.ts).
 */

// ─── Helpers ──────────────────────────────────────────────────────

async function resetRateLimit(page: import('@playwright/test').Page) {
  await page.request.post('/api/test/reset-rate-limit').catch(() => {})
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
 * Navigate to customer/horses with rate-limit-resilient loading.
 * Retries page load if the horse list is empty (likely 429 on /api/horses).
 */
async function navigateToHorseList(page: import('@playwright/test').Page) {
  await resetRateLimit(page)
  await page.goto('/customer/horses')
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await syncClientFlags(page)

  // Check if horses loaded -- if empty, reset rate limits and reload
  const horseVisible = await page.getByText('E2E Blansen')
    .isVisible({ timeout: 5000 }).catch(() => false)

  if (!horseVisible) {
    await resetRateLimit(page)
    await page.reload()
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await syncClientFlags(page)
  }
}

/**
 * Navigate to horse detail page with rate-limit-resilient loading.
 */
async function navigateToHorseDetail(
  page: import('@playwright/test').Page,
  horseId: string,
  tab?: string
) {
  await resetRateLimit(page)
  const url = tab
    ? `/customer/horses/${horseId}?tab=${tab}`
    : `/customer/horses/${horseId}`
  await page.goto(url)
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await syncClientFlags(page)

  // Check if page loaded -- retry on rate limit
  const nameVisible = await page.getByText('E2E Blansen')
    .isVisible({ timeout: 5000 }).catch(() => false)

  if (!nameVisible) {
    await resetRateLimit(page)
    await page.reload()
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await syncClientFlags(page)
  }
}

// ─── Tests ────────────────────────────────────────────────────────

test.describe('Customer Due For Service', () => {

  // Feature flag FEATURE_DUE_FOR_SERVICE=true is set via env var
  // (playwright.config.ts + .env) which has highest priority -- no admin API toggle needed.

  test.beforeAll(async () => {
    await cleanupSpecData('customer-dfs')
    await cleanupCustomerIntervals()

    const base = await getBaseEntities()

    // Seed a completed booking 90 days ago for "Hovslagning Standard"
    // with horseId linked (E2E Blansen) -- this makes the service overdue (8w = 56 days)
    await seedBooking({
      specTag: 'customer-dfs',
      status: 'completed',
      daysFromNow: -90,
      horseName: 'E2E Blansen',
      horseId: base.horseId,
      serviceId: base.service1Id,
    })
  })

  test.afterAll(async () => {
    await cleanupSpecData('customer-dfs')
    await cleanupCustomerIntervals()
  })

  test.beforeEach(async ({ page }) => {
    await resetRateLimit(page)
  })

  // ─── Badge on horse list ────────────────────────────────────────

  test('should show overdue badge on horse list', async ({ page }) => {
    await loginAsCustomer(page)
    await navigateToHorseList(page)

    // Wait for the horse list to load
    await expect(page.getByText('E2E Blansen')).toBeVisible({ timeout: 15000 })

    // Expect a red overdue badge: "Hovslagning Standard: X dagar försenad"
    const badge = page.locator('.bg-red-100').filter({ hasText: /hovslagning standard/i })
    await expect(badge).toBeVisible({ timeout: 10000 })
    await expect(badge).toContainText(/försenad/i)
  })

  // ─── Interval tab on horse detail ───────────────────────────────

  test('should show interval tab on horse detail page', async ({ page }) => {
    await loginAsCustomer(page)
    const base = await getBaseEntities()
    await navigateToHorseDetail(page, base.horseId)

    // Wait for horse name
    await expect(page.getByText('E2E Blansen')).toBeVisible({ timeout: 15000 })

    // Should have 3 tabs: Historik, Intervall, Info
    await expect(page.getByRole('tab', { name: 'Historik' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Intervall' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Info' })).toBeVisible()

    // Click Intervall tab
    await page.getByRole('tab', { name: 'Intervall' }).click()

    // Heading
    await expect(page.getByRole('heading', { name: 'Serviceintervall' })).toBeVisible()

    // Empty state
    await expect(page.getByText('Inga serviceintervall satta.')).toBeVisible()
  })

  // ─── Create an interval ─────────────────────────────────────────

  test('should create a service interval', async ({ page }) => {
    await loginAsCustomer(page)
    const base = await getBaseEntities()
    await navigateToHorseDetail(page, base.horseId, 'intervall')

    // Wait for Intervall tab to be active
    await expect(page.getByRole('heading', { name: 'Serviceintervall' })).toBeVisible({ timeout: 15000 })

    // Click "Lägg till"
    await page.getByRole('button', { name: 'Lägg till' }).click()

    // Dialog opens
    await expect(page.getByText('Lägg till serviceintervall')).toBeVisible({ timeout: 5000 })

    // Select service from dropdown
    await page.getByRole('combobox').first().click()
    await page.getByRole('option', { name: /hovslagning standard/i }).click()

    // The interval field should be prefilled with 8 (recommendedIntervalWeeks)
    const weeksInput = page.getByLabel(/intervall.*veckor/i)
    await expect(weeksInput).toHaveValue('8')

    // Change to 6 weeks
    await weeksInput.clear()
    await weeksInput.fill('6')

    // Save
    await resetRateLimit(page)
    await page.getByRole('button', { name: 'Spara' }).click()

    // Toast confirmation
    await expect(page.getByText('Intervall tillagt!')).toBeVisible({ timeout: 5000 })

    // Verify interval is displayed (scope to tab panel to avoid matching hidden select option)
    const tabPanel = page.getByRole('tabpanel')
    await expect(tabPanel.locator('p.font-medium').filter({ hasText: 'Hovslagning Standard' })).toBeVisible()
    await expect(tabPanel.getByText(/var 6 veck/i)).toBeVisible()
    await expect(tabPanel.getByText(/leverantörens rekommendation: 8 veckor/i)).toBeVisible()
  })

  // ─── Update an interval ─────────────────────────────────────────

  test('should update a service interval', async ({ page }) => {
    await loginAsCustomer(page)
    const base = await getBaseEntities()
    await navigateToHorseDetail(page, base.horseId, 'intervall')

    // Wait for interval to show
    await expect(page.getByText(/var 6 veck/i)).toBeVisible({ timeout: 15000 })

    // Click "Ändra"
    await page.getByRole('button', { name: 'Ändra' }).click()

    // Dialog opens with "Ändra serviceintervall"
    await expect(page.getByText('Ändra serviceintervall')).toBeVisible({ timeout: 5000 })

    // Update to 10 weeks
    const weeksInput = page.getByLabel(/intervall.*veckor/i)
    await weeksInput.clear()
    await weeksInput.fill('10')

    // Save
    await resetRateLimit(page)
    await page.getByRole('button', { name: 'Spara' }).click()

    // Toast confirmation
    await expect(page.getByText('Intervall uppdaterat!')).toBeVisible({ timeout: 5000 })

    // Verify updated interval
    await expect(page.getByText(/var 10 veck/i)).toBeVisible()
  })

  // ─── Delete an interval ─────────────────────────────────────────

  test('should delete a service interval', async ({ page }) => {
    await loginAsCustomer(page)
    const base = await getBaseEntities()
    await navigateToHorseDetail(page, base.horseId, 'intervall')

    // Wait for interval
    await expect(page.getByText(/var 10 veck/i)).toBeVisible({ timeout: 15000 })

    // Auto-accept the window.confirm dialog
    page.on('dialog', (dialog) => dialog.accept())

    // Click "Ta bort"
    await page.getByRole('button', { name: 'Ta bort' }).click()

    // Toast confirmation
    await expect(page.getByText('Intervall borttaget!')).toBeVisible({ timeout: 5000 })

    // Verify empty state
    await expect(page.getByText('Inga serviceintervall satta.')).toBeVisible({ timeout: 5000 })
  })
})
