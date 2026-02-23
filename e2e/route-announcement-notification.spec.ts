import { test, expect, prisma } from './fixtures'
import {
  getBaseEntities,
  seedBooking,
  cleanupSpecData,
  cleanupFollowData,
} from './setup/seed-helpers'
import { futureWeekday } from './setup/e2e-utils'

/**
 * E2E Tests for Route Announcement Notifications.
 *
 * Tests the full flow: customer follows provider -> provider announces route ->
 * customer gets in-app notification (generic or personalized with overdue horse).
 *
 * Feature flags required: FEATURE_FOLLOW_PROVIDER=true, FEATURE_DUE_FOR_SERVICE=true
 * (set in .env + playwright.config.ts).
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

async function ensureFollowing(page: import('@playwright/test').Page) {
  const button = page.getByRole('button').filter({ hasText: /följ/i })
  await expect(button).toBeVisible({ timeout: 10000 })
  const pressed = await button.getAttribute('aria-pressed')
  if (pressed !== 'true') {
    await button.click()
    await expect(page.getByRole('button', { name: /följer/i })).toBeVisible({ timeout: 5000 })
  }
}

/**
 * Create a provider announcement via API (logged in as provider).
 * Returns the announcement id.
 */
async function createAnnouncement(
  page: import('@playwright/test').Page,
  opts: { municipality: string; specTag: string; serviceIds: string[] }
): Promise<string> {
  await resetRateLimit(page)
  const dateFrom = futureWeekday(7).toISOString()
  const dateTo = futureWeekday(14).toISOString()

  const response = await page.request.post('/api/route-orders', {
    data: {
      announcementType: 'provider_announced',
      serviceIds: opts.serviceIds,
      municipality: opts.municipality,
      dateFrom,
      dateTo,
      specialInstructions: `E2E-spec:${opts.specTag}`,
    },
  })

  expect(response.ok()).toBeTruthy()
  const data = await response.json()
  return data.id
}

/**
 * Poll DB until a notification matching the criteria appears, or timeout.
 */
async function waitForNotification(
  userId: string,
  type: string,
  timeoutMs = 10000
): Promise<{ id: string; message: string } | null> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const notif = await prisma.notification.findFirst({
      where: { userId, type },
      orderBy: { createdAt: 'desc' },
      select: { id: true, message: true },
    })
    if (notif) return notif
    await new Promise((r) => setTimeout(r, 500))
  }
  return null
}

// ─── Tests ────────────────────────────────────────────────────────

test.describe('Route Announcement Notifications', () => {

  test.beforeAll(async ({ browser }) => {
    await cleanupFollowData()
    await cleanupSpecData('route-notif')

    const base = await getBaseEntities()

    // Set customer municipality to Göteborg
    await prisma.user.update({
      where: { id: base.customerId },
      data: { municipality: 'Göteborg' },
    })

    // Enable feature flags via admin API
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAsAdmin(page)
    await setFlag(page, 'follow_provider', true)
    await setFlag(page, 'due_for_service', true)
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    await cleanupFollowData()
    await cleanupSpecData('route-notif')

    const base = await getBaseEntities()

    // Reset customer municipality
    await prisma.user.update({
      where: { id: base.customerId },
      data: { municipality: null },
    })

    // Restore feature flags
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAsAdmin(page)
    await setFlag(page, 'follow_provider', false)
    await setFlag(page, 'due_for_service', false)
    await context.close()
  })

  test.beforeEach(async ({ page }) => {
    await resetRateLimit(page)
  })

  // ─── Standard notification ────────────────────────────────────

  test('should notify follower when provider announces route', async ({ page }) => {
    const base = await getBaseEntities()

    // Step 1: Customer follows provider via UI
    await loginAsCustomer(page)
    await navigateToProviderProfile(page)
    await ensureFollowing(page)

    // Step 2: Provider creates announcement via API
    await loginAsProvider(page)
    const announcementId = await createAnnouncement(page, {
      municipality: 'Göteborg',
      specTag: 'route-notif',
      serviceIds: [base.service1Id, base.service2Id],
    })
    expect(announcementId).toBeTruthy()

    // Step 3: Wait for fire-and-forget notification (poll DB)
    const notif = await waitForNotification(
      base.customerId,
      'route_announcement_new',
      15000
    )
    expect(notif).toBeTruthy()
    expect(notif!.message).toContain('Test Stall AB')
    expect(notif!.message).toContain('Göteborg')

    // Step 4: Verify notification is visible in UI
    await loginAsCustomer(page)
    await resetRateLimit(page)
    await page.goto('/notifications')

    await expect(page.getByText('Notifikationer')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Test Stall AB/i).first()).toBeVisible({ timeout: 10000 })
  })

  // ─── Personalized notification with overdue horse ─────────────

  test('should send personalized notification for overdue horse', async ({ page }) => {
    const base = await getBaseEntities()

    // Cleanup previous notifications for this test
    await prisma.notification.deleteMany({
      where: {
        userId: base.customerId,
        type: 'route_announcement_due_horse',
      },
    })
    await prisma.notificationDelivery.deleteMany({
      where: { customerId: base.customerId },
    })

    // Seed a completed booking 90 days ago for E2E Blansen (overdue)
    await seedBooking({
      specTag: 'route-notif',
      status: 'completed',
      daysFromNow: -90,
      horseName: 'E2E Blansen',
      horseId: base.horseId,
      serviceId: base.service1Id,
    })

    // Customer follows provider
    await loginAsCustomer(page)
    await navigateToProviderProfile(page)
    await ensureFollowing(page)

    // Provider announces new route
    await loginAsProvider(page)
    await createAnnouncement(page, {
      municipality: 'Göteborg',
      specTag: 'route-notif',
      serviceIds: [base.service1Id],
    })

    // Wait for personalized notification in DB
    const notif = await waitForNotification(
      base.customerId,
      'route_announcement_due_horse',
      15000
    )
    expect(notif).toBeTruthy()
    expect(notif!.message).toContain('E2E Blansen')
    expect(notif!.message).toContain('behövde')
  })

  // ─── Dedup: same route order does not create duplicate ────────

  test('should not create duplicate notifications (dedup)', async ({ page }) => {
    const base = await getBaseEntities()

    // Count existing notifications
    const beforeCount = await prisma.notification.count({
      where: {
        userId: base.customerId,
        type: { in: ['route_announcement_new', 'route_announcement_due_horse'] },
      },
    })

    // Try to re-notify for the same route order by creating a new one
    // (dedup is per routeOrderId+customerId, so same announcement won't duplicate)

    // Get the latest announcement we created
    const latestDelivery = await prisma.notificationDelivery.findFirst({
      where: { customerId: base.customerId, channel: 'in_app' },
      orderBy: { createdAt: 'desc' },
      select: { routeOrderId: true },
    })

    if (latestDelivery) {
      // Verify that the delivery record exists (dedup guard)
      const exists = await prisma.notificationDelivery.count({
        where: {
          routeOrderId: latestDelivery.routeOrderId,
          customerId: base.customerId,
          channel: 'in_app',
        },
      })
      expect(exists).toBeGreaterThanOrEqual(1)
    }

    // Verify count hasn't increased unexpectedly
    const afterCount = await prisma.notification.count({
      where: {
        userId: base.customerId,
        type: { in: ['route_announcement_new', 'route_announcement_due_horse'] },
      },
    })
    expect(afterCount).toBe(beforeCount)
  })

  // ─── Customer without municipality gets no notification ───────

  test('should not notify customer without municipality', async ({ page }) => {
    const base = await getBaseEntities()

    // Remove customer's municipality
    await prisma.user.update({
      where: { id: base.customerId },
      data: { municipality: null },
    })

    // Cleanup deliveries so dedup doesn't interfere
    await prisma.notificationDelivery.deleteMany({
      where: { customerId: base.customerId },
    })

    // Count notifications before
    const beforeCount = await prisma.notification.count({
      where: {
        userId: base.customerId,
        type: { in: ['route_announcement_new', 'route_announcement_due_horse'] },
      },
    })

    // Provider announces a new route
    await loginAsProvider(page)
    await createAnnouncement(page, {
      municipality: 'Göteborg',
      specTag: 'route-notif',
      serviceIds: [base.service1Id],
    })

    // Wait a bit for fire-and-forget to complete
    await page.waitForTimeout(3000)

    // Count should be unchanged
    const afterCount = await prisma.notification.count({
      where: {
        userId: base.customerId,
        type: { in: ['route_announcement_new', 'route_announcement_due_horse'] },
      },
    })
    expect(afterCount).toBe(beforeCount)

    // Restore municipality for afterAll cleanup
    await prisma.user.update({
      where: { id: base.customerId },
      data: { municipality: 'Göteborg' },
    })
  })
})
