import { test, expect } from './fixtures'
import { cleanupFollowData } from './setup/seed-helpers'

/**
 * E2E Tests for Follow Provider feature.
 *
 * Covers:
 * - Follow/unfollow toggle with optimistic UI
 * - Follow persists across navigation
 * - Municipality selection in customer profile
 * - Provider cannot see FollowButton (customer-only)
 *
 * NOTE: Feature flag is enabled via admin API in beforeAll.
 * Follow state is managed via UI clicks (not Prisma seeding) to avoid
 * dev mode module-isolation issues where different API route instances
 * may have different feature flag state.
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

async function loginAsProvider(page: import('@playwright/test').Page) {
  await page.context().clearCookies()
  await resetRateLimit(page)
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('provider@example.com')
  await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!')
  await page.getByRole('button', { name: /logga in/i }).click()
  await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 15000 })
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
 * Navigate to the seed provider's profile page.
 */
async function navigateToProviderProfile(page: import('@playwright/test').Page) {
  await resetRateLimit(page)
  await page.goto('/providers')
  await page.waitForSelector('[data-testid="provider-card"]', { timeout: 10000 })

  const providerCard = page.locator('[data-testid="provider-card"]')
    .filter({ hasText: /Test Stall AB/i })

  const targetCard = await providerCard.count() > 0
    ? providerCard.first()
    : page.locator('[data-testid="provider-card"]').first()

  await targetCard.getByRole('link', { name: /se profil/i }).click()

  await expect(page.getByText(/tillgängliga tjänster/i)).toBeVisible({ timeout: 10000 })
  await syncClientFlags(page)
}

/**
 * Wait for the FollowButton to appear (either state).
 * Returns true if "Följer" (following), false if "Följ" (not following).
 */
async function waitForFollowButton(page: import('@playwright/test').Page): Promise<boolean> {
  const button = page.getByRole('button').filter({ hasText: /följ/i })
  await expect(button).toBeVisible({ timeout: 10000 })
  const pressed = await button.getAttribute('aria-pressed')
  return pressed === 'true'
}

/**
 * Ensure the customer is NOT following.
 */
async function ensureNotFollowing(page: import('@playwright/test').Page) {
  const isFollowing = await waitForFollowButton(page)
  if (isFollowing) {
    await page.getByRole('button', { name: /följer/i }).click()
    await page.waitForTimeout(500)
  }
}

/**
 * Ensure the customer IS following.
 */
async function ensureFollowing(page: import('@playwright/test').Page) {
  const isFollowing = await waitForFollowButton(page)
  if (!isFollowing) {
    await page.getByRole('button').filter({ hasText: /följ/i }).click()
    await expect(page.getByRole('button', { name: /följer/i })).toBeVisible({ timeout: 5000 })
  }
}

// ─── Tests ────────────────────────────────────────────────────────

test.describe('Follow Provider', () => {

  test.beforeAll(async ({ browser }) => {
    await cleanupFollowData()

    // Enable follow_provider via admin API
    const context = await browser.newContext()
    const page = await context.newPage()
    await resetRateLimit(page)
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('admin@example.com')
    await page.getByLabel('Lösenord', { exact: true }).fill('AdminPass123!')
    await page.getByRole('button', { name: /logga in/i }).click()
    await expect(page).toHaveURL(/\/(dashboard|admin|providers)/, { timeout: 15000 })
    await setFlag(page, 'follow_provider', true)
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    await cleanupFollowData()

    const context = await browser.newContext()
    const page = await context.newPage()
    await resetRateLimit(page)
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('admin@example.com')
    await page.getByLabel('Lösenord', { exact: true }).fill('AdminPass123!')
    await page.getByRole('button', { name: /logga in/i }).click()
    await expect(page).toHaveURL(/\/(dashboard|admin|providers)/, { timeout: 15000 })
    await setFlag(page, 'follow_provider', false)
    await context.close()
  })

  test.beforeEach(async ({ page }) => {
    await resetRateLimit(page)
  })

  // ─── Follow ──────────────────────────────────────────────────────

  test('should follow a provider and show updated state', async ({ page }) => {
    await loginAsCustomer(page)
    await navigateToProviderProfile(page)
    await ensureNotFollowing(page)

    // FollowButton should show "Följ" with aria-pressed=false
    const followButton = page.getByRole('button').filter({ hasText: /följ/i })
    await expect(followButton).toHaveAttribute('aria-pressed', 'false')

    // Click to follow
    await followButton.click()

    // Should show "Följer" with optimistic update
    const followingButton = page.getByRole('button', { name: /följer/i })
    await expect(followingButton).toBeVisible({ timeout: 5000 })
    await expect(followingButton).toHaveAttribute('aria-pressed', 'true')

    // Follower count should appear in the button
    await expect(page.getByRole('button', { name: /följer.*\(1\)/i })).toBeVisible({ timeout: 5000 })
  })

  // ─── Unfollow ────────────────────────────────────────────────────

  test('should unfollow a provider and show updated state', async ({ page }) => {
    await loginAsCustomer(page)
    await navigateToProviderProfile(page)
    await ensureFollowing(page)

    // Verify following state
    const followingButton = page.getByRole('button', { name: /följer/i })
    await expect(followingButton).toBeVisible({ timeout: 5000 })

    // Click to unfollow
    await followingButton.click()

    // Should show "Följ" (not following state)
    await expect(
      page.getByRole('button').filter({ hasText: /följ/i })
    ).toHaveAttribute('aria-pressed', 'false', { timeout: 5000 })
  })

  // ─── Persist across navigation ───────────────────────────────────

  test('should persist follow state across navigation', async ({ page }) => {
    await loginAsCustomer(page)
    await navigateToProviderProfile(page)
    await ensureFollowing(page)

    // Verify following state before navigating away
    await expect(page.getByRole('button', { name: /följer/i })).toBeVisible({ timeout: 5000 })

    // Navigate away to the providers list
    await resetRateLimit(page)
    await page.goto('/providers')
    await page.waitForSelector('[data-testid="provider-card"]', { timeout: 10000 })

    // Navigate back to the same provider profile
    const providerCard = page.locator('[data-testid="provider-card"]')
      .filter({ hasText: /Test Stall AB/i })
    const targetCard = await providerCard.count() > 0
      ? providerCard.first()
      : page.locator('[data-testid="provider-card"]').first()
    await targetCard.getByRole('link', { name: /se profil/i }).click()

    await expect(page.getByText(/tillgängliga tjänster/i)).toBeVisible({ timeout: 10000 })
    await syncClientFlags(page)

    // Should still show "Följer" after navigating back
    await expect(page.getByRole('button', { name: /följer/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /följer/i })).toHaveAttribute('aria-pressed', 'true')
  })

  // ─── Provider cannot follow ──────────────────────────────────────

  test('should NOT show FollowButton for provider users', async ({ page }) => {
    await loginAsProvider(page)

    await resetRateLimit(page)
    await page.goto('/providers')
    await page.waitForSelector('[data-testid="provider-card"]', { timeout: 10000 })

    const providerCard = page.locator('[data-testid="provider-card"]')
      .filter({ hasText: /Test Stall AB/i })
    const targetCard = await providerCard.count() > 0
      ? providerCard.first()
      : page.locator('[data-testid="provider-card"]').first()

    await targetCard.getByRole('link', { name: /se profil/i }).click()
    await expect(page.getByText(/tillgängliga tjänster/i)).toBeVisible({ timeout: 10000 })
    await syncClientFlags(page)

    // FollowButton should NOT be visible for provider users
    await expect(page.getByRole('button', { name: /följ/i })).not.toBeVisible({ timeout: 3000 })
  })

  // ─── Municipality in customer profile ─────────────────────────────

  test('should set municipality in customer profile', async ({ page }) => {
    // Fresh login with aggressive rate limit resets
    await resetRateLimit(page)
    await loginAsCustomer(page)
    await resetRateLimit(page)

    // Navigate to profile and wait for network to settle
    await page.goto('/customer/profile')
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

    // If stuck on loading, try resetting rate limits and reloading
    const headingVisible = await page.getByRole('heading', { name: /min profil/i })
      .isVisible({ timeout: 5000 }).catch(() => false)

    if (!headingVisible) {
      await resetRateLimit(page)
      await page.reload()
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    }

    await expect(page.getByRole('heading', { name: /min profil/i })).toBeVisible({ timeout: 15000 })

    // Verify municipality label in read mode
    await expect(page.getByText('Kommun')).toBeVisible()

    // Enter edit mode
    await page.getByRole('button', { name: /redigera profil/i }).click()
    await expect(page.getByLabel(/förnamn/i)).toBeVisible({ timeout: 5000 })

    // Find municipality input (combobox)
    const municipalityInput = page.getByRole('combobox')
    await expect(municipalityInput).toBeVisible()

    // Type to search for a municipality
    await municipalityInput.clear()
    await municipalityInput.fill('Göte')

    // Wait for dropdown to appear
    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible({ timeout: 5000 })

    // Select "Göteborg" from the dropdown
    await listbox.getByRole('option', { name: 'Göteborg' }).click()

    // Verify the input has the selected value
    await expect(municipalityInput).toHaveValue('Göteborg')

    // Verify helper text about notifications
    await expect(page.getByText(/notiser när leverantörer du följer/i)).toBeVisible()

    // Save
    await resetRateLimit(page)
    await page.getByRole('button', { name: /spara ändringar/i }).click()
    await expect(page.getByRole('button', { name: /redigera profil/i })).toBeVisible({ timeout: 10000 })

    // Verify municipality is shown in read mode
    await expect(page.getByText('Göteborg').first()).toBeVisible()

    // Clean up: remove municipality
    await page.getByRole('button', { name: /redigera profil/i }).click()
    await expect(page.getByLabel(/förnamn/i)).toBeVisible({ timeout: 5000 })
    const municipalityInputCleanup = page.getByRole('combobox')
    await municipalityInputCleanup.clear()
    await resetRateLimit(page)
    await page.getByRole('button', { name: /spara ändringar/i }).click()
    await expect(page.getByRole('button', { name: /redigera profil/i })).toBeVisible({ timeout: 10000 })
  })
})
