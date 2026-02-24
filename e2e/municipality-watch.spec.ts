import { test, expect } from './fixtures'
import { cleanupMunicipalityWatchData } from './setup/seed-helpers'

/**
 * E2E Tests for Municipality Watch feature.
 *
 * Covers:
 * - Card visibility on customer profile
 * - Add a watch (municipality + service type)
 * - Combobox suggestions for service types
 * - Watch counter display
 * - Remove a watch
 * - Persistence across page reload
 *
 * Feature flag enabled via FEATURE_MUNICIPALITY_WATCH=true in
 * .env + playwright.config.ts webServer.env (env var has highest priority).
 */

// --- Helpers ---

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

async function syncClientFlags(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('featureflags-changed'))
  })
  await page.waitForTimeout(500)
}

async function navigateToProfile(page: import('@playwright/test').Page) {
  await resetRateLimit(page)
  await page.goto('/customer/profile')
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

  const headingVisible = await page.getByRole('heading', { name: /min profil/i })
    .isVisible({ timeout: 5000 }).catch(() => false)

  if (!headingVisible) {
    await resetRateLimit(page)
    await page.reload()
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  }

  await expect(page.getByRole('heading', { name: /min profil/i })).toBeVisible({ timeout: 15000 })
  await syncClientFlags(page)
}

/**
 * Select a municipality from the watch card's MunicipalitySelect.
 */
async function selectWatchMunicipality(page: import('@playwright/test').Page, name: string) {
  const input = page.locator('#watch-municipality')
  await input.clear()
  await input.fill(name.substring(0, 3))

  const listbox = page.locator('#municipality-listbox')
  await expect(listbox).toBeVisible({ timeout: 5000 })
  await listbox.getByRole('option', { name }).click()
}

/**
 * Select a service type from the watch card's ServiceTypeSelect combobox.
 */
async function fillServiceType(page: import('@playwright/test').Page, name: string) {
  const input = page.locator('#watch-service')
  await input.clear()
  await input.fill(name.substring(0, 3))

  const listbox = page.locator('#service-type-listbox')
  await expect(listbox).toBeVisible({ timeout: 5000 })
  await listbox.getByRole('option', { name }).click()
}

// --- Tests ---

test.describe('Municipality Watch', () => {

  test.beforeAll(async () => {
    await cleanupMunicipalityWatchData()
  })

  test.afterAll(async () => {
    await cleanupMunicipalityWatchData()
  })

  test.beforeEach(async ({ page }) => {
    await resetRateLimit(page)
  })

  // --- Card visibility ---

  test('should show Bevakningar card on customer profile', async ({ page }) => {
    await loginAsCustomer(page)
    await navigateToProfile(page)

    // CardTitle renders as <div>, not heading -- use getByText
    await expect(page.getByText('Bevakningar', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Få notis när leverantörer annonserar tjänster i ditt område')).toBeVisible()
    await expect(page.getByText('Du har inga aktiva bevakningar')).toBeVisible()
  })

  // --- Add watch ---

  test('should add a municipality watch', async ({ page }) => {
    await loginAsCustomer(page)
    await navigateToProfile(page)

    await selectWatchMunicipality(page, 'Göteborg')
    await fillServiceType(page, 'Hovslagning Standard')

    await resetRateLimit(page)
    await page.getByRole('button', { name: 'Lägg till bevakning' }).click()

    await expect(page.getByText('Hovslagning Standard i Göteborg')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('1 av 10 bevakningar')).toBeVisible()
    await expect(page.getByText('Du har inga aktiva bevakningar')).not.toBeVisible()
  })

  // --- Autocomplete ---

  test('should show combobox suggestions for service types', async ({ page }) => {
    await loginAsCustomer(page)
    await navigateToProfile(page)

    const serviceInput = page.locator('#watch-service')
    await serviceInput.fill('Hov')

    const listbox = page.locator('#service-type-listbox')
    await expect(listbox).toBeVisible({ timeout: 5000 })

    const option = listbox.getByRole('option').filter({ hasText: /hovslagning/i })
    await expect(option.first()).toBeVisible({ timeout: 5000 })

    await option.first().click()

    await expect(serviceInput).toHaveValue(/Hovslagning/i)
  })

  // --- Remove watch ---

  test('should remove a municipality watch', async ({ page }) => {
    await loginAsCustomer(page)
    await navigateToProfile(page)

    // Ensure at least one watch exists
    const hasWatch = await page.getByText('av 10 bevakningar').isVisible().catch(() => false)
    if (!hasWatch) {
      await selectWatchMunicipality(page, 'Göteborg')
      await fillServiceType(page, 'Hovslagning Standard')
      await resetRateLimit(page)
      await page.getByRole('button', { name: 'Lägg till bevakning' }).click()
      await expect(page.getByText('av 10 bevakningar')).toBeVisible({ timeout: 5000 })
    }

    const removeButton = page.getByRole('button', { name: /ta bort bevakning/i }).first()
    await resetRateLimit(page)
    await removeButton.click()

    await expect(page.getByText('Du har inga aktiva bevakningar')).toBeVisible({ timeout: 5000 })
  })

  // --- Persistence across reload ---

  test('should persist watches across page reload', async ({ page }) => {
    await loginAsCustomer(page)
    await navigateToProfile(page)

    await selectWatchMunicipality(page, 'Malmö')
    await fillServiceType(page, 'Ridlektion')
    await resetRateLimit(page)
    await page.getByRole('button', { name: 'Lägg till bevakning' }).click()
    await expect(page.getByText('Ridlektion i Malmö')).toBeVisible({ timeout: 5000 })

    // Reload and verify persistence
    await resetRateLimit(page)
    await page.reload()
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await syncClientFlags(page)

    await expect(page.getByText('Ridlektion i Malmö')).toBeVisible({ timeout: 10000 })

    // Clean up
    await resetRateLimit(page)
    await page.getByRole('button', { name: /ta bort bevakning ridlektion i malmö/i }).click()
    await expect(page.getByText('Du har inga aktiva bevakningar')).toBeVisible({ timeout: 5000 })
  })
})
