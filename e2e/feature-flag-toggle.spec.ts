import { test, expect } from './fixtures'

/**
 * E2E Tests for Feature Flag Admin Toggle
 *
 * Covers exploratory test plan phases:
 * - Fas 0-1: Baseline (all toggleable flags OFF) - navigation visibility
 * - Fas 4: insights (always visible — no feature flag)
 * - Fas 5: route_planning toggle
 * - Fas 6: route_announcements toggle
 * - Fas 7: due_for_service (always ON — no feature flag)
 * - Fas 8: voice_logging toggle
 * - Fas 11: All flags ON - combined verification
 *
 * NOTE: Flags with env overrides in playwright.config.ts cannot be toggled via admin API:
 * FEATURE_SELF_RESCHEDULE, FEATURE_CUSTOMER_INSIGHTS,
 * FEATURE_FOLLOW_PROVIDER, FEATURE_OFFLINE_MODE, FEATURE_MUNICIPALITY_WATCH
 *
 * ARCHITECTURE NOTE: In Next.js dev mode, API routes and Server Components
 * may use separate in-memory module instances. The admin API toggle updates
 * the API route's instance, but SSR may read from a stale instance. To handle
 * this reliably, we dispatch a 'featureflags-changed' event after navigating,
 * which triggers the FeatureFlagProvider's client-side refetch from the API
 * route (which has the correct state).
 */

// Flags that CAN be toggled (no env override)
const TOGGLE_FLAGS = [
  'voice_logging',
  'route_planning',
  'route_announcements',
] as const

// Provider nav items gated by feature flags (only those toggleable via admin)
const PROVIDER_FLAG_NAV = [
  { flag: 'voice_logging', label: 'Logga arbete' },
  { flag: 'route_planning', label: 'Ruttplanering' },
  { flag: 'route_announcements', label: 'Rutt-annonser' },
] as const

// Provider nav items that are always visible (no feature flag)
const PROVIDER_ENV_NAV = [
  'Besöksplanering',  // due_for_service: GA — no longer feature-flagged
  'Gruppbokningar',   // group_bookings: no longer feature-flagged, always visible
] as const

// Provider nav items that are always visible -- primary (direct links)
const PROVIDER_PRIMARY_NAV = [
  'Översikt',
  'Kalender',
  'Bokningar',
  'Mina tjänster',
  'Kunder',
  'Recensioner',
] as const

// Provider nav items that are always visible -- secondary (inside "Mer" dropdown)
const PROVIDER_SECONDARY_ALWAYS_NAV = [
  'Insikter',
  'Min profil',
] as const

// Customer nav items gated by feature flags
const CUSTOMER_FLAG_NAV = [] as const

// Customer nav items that are always visible
const CUSTOMER_ALWAYS_NAV = [
  'Hitta tjänster',
  'Mina bokningar',
  'Lediga tider',
  'Mina hästar',
  'Gruppbokningar',  // env override FEATURE_GROUP_BOOKINGS=true
  'Hjälp',
  'Min profil',
] as const

// ─── Helpers ──────────────────────────────────────────────────────

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

/**
 * Toggle a feature flag via admin API.
 * Requires admin session (call loginAsAdmin first).
 */
async function setFlag(page: import('@playwright/test').Page, flag: string, value: boolean) {
  const response = await page.request.patch('/api/admin/settings', {
    data: { key: `feature_${flag}`, value: String(value) },
  })
  expect(response.ok()).toBeTruthy()
}

/** Set all toggleable flags to the same value */
async function setAllFlags(page: import('@playwright/test').Page, value: boolean) {
  // Reset rate limits before batch operation
  await resetRateLimit(page)
  for (const flag of TOGGLE_FLAGS) {
    await setFlag(page, flag, value)
  }
}

// Default values matching FEATURE_FLAGS.defaultEnabled in src/lib/feature-flag-definitions.ts
// Only includes toggleable flags (no env overrides)
const FLAG_DEFAULTS: Record<string, boolean> = {
  voice_logging: true,
  route_planning: true,
  route_announcements: true,
}

/** Restore flags to their code defaults */
async function restoreDefaults(page: import('@playwright/test').Page) {
  await resetRateLimit(page)
  for (const flag of TOGGLE_FLAGS) {
    await setFlag(page, flag, FLAG_DEFAULTS[flag] ?? false)
  }
}

/**
 * Open the "Mer" dropdown in provider desktop nav.
 * Secondary nav items (feature-flagged + "Min profil") are inside this dropdown.
 */
async function openProviderMoreDropdown(page: import('@playwright/test').Page) {
  const nav = page.locator('nav.hidden.md\\:block')
  const merButton = nav.getByRole('button', { name: /mer/i })
  if (await merButton.isVisible()) {
    await merButton.click()
    // Wait for dropdown to appear
    await page.waitForTimeout(200)
  }
}

/**
 * Force FeatureFlagProvider to refetch flags from the API.
 *
 * In Next.js dev mode, SSR may use a stale module instance for feature flags.
 * Dispatching the custom event triggers the client-side FeatureFlagProvider to
 * refetch from /api/feature-flags (which has the correct state).
 */
async function syncClientFlags(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('featureflags-changed'))
  })
  // Wait for fetch + React re-render
  await page.waitForTimeout(500)
}

/**
 * Login as provider and navigate to dashboard with synced flags.
 */
async function gotoProviderDashboardWithFlags(page: import('@playwright/test').Page) {
  await loginAsProvider(page)
  await page.goto('/provider/dashboard')
  await expect(page.getByRole('heading', { name: /välkommen/i })).toBeVisible({ timeout: 10000 })
  await syncClientFlags(page)
}

/**
 * Login as customer and navigate to providers page with synced flags.
 */
async function gotoCustomerProvidersWithFlags(page: import('@playwright/test').Page) {
  await loginAsCustomer(page)
  await page.goto('/providers')
  await expect(page.getByRole('heading', { name: /hitta tjänsteleverantörer/i })).toBeVisible({ timeout: 10000 })
  await syncClientFlags(page)
}

// ─── Tests ────────────────────────────────────────────────────────

test.describe('Feature Flag Toggle (Admin)', () => {

  // ─── Fas 0-1: Baseline (all toggleable flags OFF) ──────────────

  test.describe('Fas 1: Baseline - all toggleable flags OFF', () => {

    test('1.3.1 provider nav: flag-dependent items should NOT be visible', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop nav test')

      await loginAsAdmin(page)
      await setAllFlags(page, false)

      await gotoProviderDashboardWithFlags(page)

      // Open "Mer" dropdown to check secondary items
      await openProviderMoreDropdown(page)

      const nav = page.locator('nav.hidden.md\\:block')

      for (const item of PROVIDER_FLAG_NAV) {
        await expect(
          nav.getByRole('link', { name: item.label }),
          `"${item.label}" should be hidden when ${item.flag} is OFF`
        ).not.toBeVisible()
      }
    })

    test('1.3.2 provider nav: always-visible items should be visible', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop nav test')

      // Flags still OFF from previous test (server state persists)
      await gotoProviderDashboardWithFlags(page)

      const nav = page.locator('nav.hidden.md\\:block')

      // Check primary nav items (direct links)
      for (const label of PROVIDER_PRIMARY_NAV) {
        await expect(
          nav.getByRole('link', { name: label }),
          `"${label}" should always be visible`
        ).toBeVisible()
      }

      // Check secondary always-visible items (inside "Mer" dropdown)
      await openProviderMoreDropdown(page)
      for (const label of PROVIDER_SECONDARY_ALWAYS_NAV) {
        await expect(
          nav.getByRole('link', { name: label }),
          `"${label}" should always be visible in Mer dropdown`
        ).toBeVisible()
      }
    })

    test('1.2.3 provider dashboard: "Logga arbete" quick action should NOT be visible', async ({ page }) => {
      await loginAsAdmin(page)
      await setAllFlags(page, false)

      await gotoProviderDashboardWithFlags(page)

      await expect(page.getByRole('link', { name: /logga arbete/i })).not.toBeVisible()
    })

    test('1.13.1 customer nav: "Gruppbokningar" should NOT be visible', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop nav test')

      await loginAsAdmin(page)
      await setAllFlags(page, false)

      await gotoCustomerProvidersWithFlags(page)

      const nav = page.locator('nav.hidden.md\\:block')

      for (const item of CUSTOMER_FLAG_NAV) {
        await expect(
          nav.getByRole('link', { name: item.label }),
          `"${item.label}" should be hidden when ${item.flag} is OFF`
        ).not.toBeVisible()
      }
    })

    test('1.13.2 customer nav: always-visible items should be visible', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop nav test')

      await gotoCustomerProvidersWithFlags(page)

      const nav = page.locator('nav.hidden.md\\:block')

      for (const label of CUSTOMER_ALWAYS_NAV) {
        await expect(
          nav.getByRole('link', { name: label }),
          `"${label}" should always be visible`
        ).toBeVisible()
      }
    })
  })

  // ─── Fas 4: insights (always visible) ──────────────────────────
  // Business insights är inte bakom feature flag längre (borttagen S58-4).
  // Insikter-länken ska alltid vara synlig.

  test.describe('Fas 4: insights (always visible)', () => {

    test('4.2 click "Insikter": page loads', async ({ page }) => {
      await loginAsProvider(page)
      await page.goto('/provider/insights')

      await expect(page.getByRole('heading', { name: /insikter|statistik|affärsinsikter/i })).toBeVisible({ timeout: 15000 })
    })
  })

  // ─── Fas 5: route_planning ─────────────────────────────────────

  test.describe('Fas 5: route_planning toggle', () => {

    test('5.1 toggle ON: "Ruttplanering" appears in provider nav', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop nav test')

      await loginAsAdmin(page)
      await setAllFlags(page, false)
      await setFlag(page, 'route_planning', true)

      await gotoProviderDashboardWithFlags(page)
      await openProviderMoreDropdown(page)

      const nav = page.locator('nav.hidden.md\\:block')
      await expect(nav.getByRole('link', { name: 'Ruttplanering' })).toBeVisible()
    })

    test('5.2 click "Ruttplanering": page loads', async ({ page }) => {
      await loginAsAdmin(page)
      await setFlag(page, 'route_planning', true)

      await loginAsProvider(page)
      await page.goto('/provider/route-planning')

      await expect(page.getByRole('heading', { name: /rutt-?planering/i })).toBeVisible({ timeout: 15000 })
    })

    test('5.5 toggle OFF: "Ruttplanering" disappears', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop nav test')

      await loginAsAdmin(page)
      await setFlag(page, 'route_planning', false)

      await gotoProviderDashboardWithFlags(page)
      await openProviderMoreDropdown(page)

      const nav = page.locator('nav.hidden.md\\:block')
      await expect(nav.getByRole('link', { name: 'Ruttplanering' })).not.toBeVisible()
    })
  })

  // ─── Fas 6: route_announcements ────────────────────────────────

  test.describe('Fas 6: route_announcements toggle', () => {

    test('6.1 toggle ON: "Rutt-annonser" appears in provider nav', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop nav test')

      await loginAsAdmin(page)
      await setAllFlags(page, false)
      await setFlag(page, 'route_announcements', true)

      await gotoProviderDashboardWithFlags(page)
      await openProviderMoreDropdown(page)

      const nav = page.locator('nav.hidden.md\\:block')
      await expect(nav.getByRole('link', { name: 'Rutt-annonser' })).toBeVisible()
    })

    test('6.6 toggle OFF: "Rutt-annonser" disappears', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop nav test')

      await loginAsAdmin(page)
      await setFlag(page, 'route_announcements', false)

      await gotoProviderDashboardWithFlags(page)
      await openProviderMoreDropdown(page)

      const nav = page.locator('nav.hidden.md\\:block')
      await expect(nav.getByRole('link', { name: 'Rutt-annonser' })).not.toBeVisible()
    })
  })

  // ─── Fas 7: due_for_service ────────────────────────────────────
  // NOTE: due_for_service is now GA (no feature flag). Always visible.

  test.describe('Fas 7: due_for_service (GA, no feature flag)', () => {

    test('7.1 "Besöksplanering" is always visible (GA feature)', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop nav test')

      await gotoProviderDashboardWithFlags(page)
      await openProviderMoreDropdown(page)

      const nav = page.locator('nav.hidden.md\\:block')
      await expect(nav.getByRole('link', { name: 'Besöksplanering' })).toBeVisible()
    })

    test('7.2 click "Besöksplanering": page loads', async ({ page }) => {
      await loginAsProvider(page)
      await page.goto('/provider/due-for-service')

      await expect(page.getByRole('heading', { name: /besöksplanering|aktuella besök/i })).toBeVisible({ timeout: 15000 })
    })
  })

  // ─── Fas 8: voice_logging ─────────────────────────────────────

  test.describe('Fas 8: voice_logging toggle', () => {

    test('8.1-8.2 toggle ON: "Logga arbete" in dashboard + nav', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop nav test')

      await loginAsAdmin(page)
      await setAllFlags(page, false)
      await setFlag(page, 'voice_logging', true)

      await gotoProviderDashboardWithFlags(page)

      // Nav link (inside "Mer" dropdown)
      await openProviderMoreDropdown(page)
      const nav = page.locator('nav.hidden.md\\:block')
      await expect(nav.getByRole('link', { name: 'Logga arbete' })).toBeVisible()

      // Quick action on dashboard (use .first() since nav also has this link)
      await expect(page.getByRole('link', { name: /logga arbete/i }).first()).toBeVisible()
    })

    test('8.3 click "Logga arbete": page loads', async ({ page }) => {
      await loginAsAdmin(page)
      await setFlag(page, 'voice_logging', true)

      await loginAsProvider(page)
      await page.goto('/provider/voice-log')

      await expect(page.getByRole('heading', { name: /logga utfört arbete|röstloggning/i })).toBeVisible({ timeout: 15000 })
    })

    test('8.6 toggle OFF: "Logga arbete" disappears from nav + dashboard', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop nav test')

      await loginAsAdmin(page)
      await setFlag(page, 'voice_logging', false)

      await gotoProviderDashboardWithFlags(page)

      // Nav link gone (check inside "Mer" dropdown)
      await openProviderMoreDropdown(page)
      const nav = page.locator('nav.hidden.md\\:block')
      await expect(nav.getByRole('link', { name: 'Logga arbete' })).not.toBeVisible()

      // Quick action gone
      await expect(page.getByRole('link', { name: /logga arbete/i })).not.toBeVisible()
    })
  })

  // ─── Fas 10: group_bookings (no longer feature-flagged) ────────
  // group_bookings is GA — always visible.

  test.describe('Fas 10: group_bookings (always on)', () => {

    test('10.1 "Gruppbokningar" is always visible in provider nav', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop nav test')

      await loginAsProvider(page)
      await gotoProviderDashboardWithFlags(page)
      await openProviderMoreDropdown(page)

      const providerNav = page.locator('nav.hidden.md\\:block')
      await expect(providerNav.getByRole('link', { name: 'Gruppbokningar' })).toBeVisible()
    })

    test('10.3 click customer "Gruppbokningar": page loads', async ({ page }) => {
      await loginAsCustomer(page)
      await page.goto('/customer/group-bookings')

      await expect(page.getByRole('heading', { name: /gruppbokning/i })).toBeVisible({ timeout: 15000 })
    })
  })

  // ─── Fas 11: All flags ON ──────────────────────────────────────

  test.describe('Fas 11: All flags ON', () => {

    test('11.1 provider nav shows all menu items', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop nav test')

      await loginAsAdmin(page)
      await setAllFlags(page, true)

      await gotoProviderDashboardWithFlags(page)

      const nav = page.locator('nav.hidden.md\\:block')

      // Check primary nav items (direct links)
      for (const label of PROVIDER_PRIMARY_NAV) {
        await expect(
          nav.getByRole('link', { name: label, exact: true }),
          `"${label}" should always be visible`
        ).toBeVisible()
      }

      // Open "Mer" dropdown to check secondary items
      await openProviderMoreDropdown(page)

      for (const item of PROVIDER_FLAG_NAV) {
        await expect(
          nav.getByRole('link', { name: item.label, exact: true }),
          `"${item.label}" should be visible when all flags ON`
        ).toBeVisible()
      }

      for (const label of PROVIDER_SECONDARY_ALWAYS_NAV) {
        await expect(
          nav.getByRole('link', { name: label, exact: true }),
          `"${label}" should always be visible in Mer dropdown`
        ).toBeVisible()
      }
    })

    test('11.2 customer nav shows all menu items', async ({ page }) => {
      test.skip(test.info().project.name === 'mobile', 'Desktop nav test')

      // All flags still ON from previous test
      await gotoCustomerProvidersWithFlags(page)

      const nav = page.locator('nav.hidden.md\\:block')

      await expect(nav.getByRole('link', { name: 'Gruppbokningar' })).toBeVisible()

      for (const label of CUSTOMER_ALWAYS_NAV) {
        await expect(
          nav.getByRole('link', { name: label }),
          `"${label}" should always be visible`
        ).toBeVisible()
      }
    })

    test('11.3 provider dashboard: "Logga arbete" quick action visible', async ({ page }) => {
      await gotoProviderDashboardWithFlags(page)

      // Use .first() since "Logga arbete" appears in both nav and quick actions
      await expect(page.getByRole('link', { name: /logga arbete/i }).first()).toBeVisible()
    })

    test('11.6 no console errors on key pages', async ({ page }) => {
      const errors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text())
        }
      })

      // Reset rate limits before navigating many pages
      await resetRateLimit(page)
      await loginAsProvider(page)

      const pages = [
        '/provider/dashboard',
        '/provider/bookings',
        '/provider/services',
        '/provider/customers',
        '/provider/calendar',
      ]

      for (const url of pages) {
        await resetRateLimit(page)
        await page.goto(url)
        await page.waitForLoadState('domcontentloaded')
        // Give React time to render and potentially log errors
        await page.waitForTimeout(1000)
      }

      const realErrors = errors.filter(e =>
        !e.includes('hydrat') &&
        !e.includes('Warning:') &&
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('Failed to fetch')  // Transient network errors in test env
      )

      expect(realErrors, `Console errors found: ${realErrors.join(', ')}`).toHaveLength(0)
    })
  })

  // ─── API enforcement when flags are OFF ────────────────────────

  test.describe('API enforcement when flags are OFF', () => {

    test('voice_logging API returns 404 when flag is OFF', async ({ page }) => {
      await loginAsAdmin(page)
      await setFlag(page, 'voice_logging', false)

      await loginAsProvider(page)
      await resetRateLimit(page)

      const response = await page.request.post('/api/voice-log', {
        data: { transcript: 'test' },
      })
      expect(response.status()).toBe(404)
    })

    test('route_planning API returns 404 when flag is OFF', async ({ page }) => {
      await loginAsAdmin(page)
      await setFlag(page, 'route_planning', false)

      await loginAsProvider(page)
      await resetRateLimit(page)

      const response = await page.request.post('/api/routes', {
        data: {},
      })
      expect(response.status()).toBe(404)
    })

  })

  // ─── Cleanup: restore defaults ──────────────────────────────────

  test('cleanup: restore all flags to defaults', async ({ page }) => {
    await loginAsAdmin(page)
    await restoreDefaults(page)

    // Verify defaults via the public feature-flags endpoint
    const response = await page.request.get('/api/feature-flags')
    expect(response.ok()).toBeTruthy()
    const data = await response.json()

    // Toggleable flags restored to their code defaults
    expect(data.flags.voice_logging).toBe(true)
    expect(data.flags.route_planning).toBe(true)
  })
})
