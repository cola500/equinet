import { test, expect } from './fixtures'
import { prisma } from './fixtures'
import { seedBooking, getBaseEntities, cleanupSpecData } from './setup/seed-helpers'

const SPEC_TAG = 'accepting'

/**
 * E2E Tests for acceptingNewCustomers feature
 *
 * Tests:
 * - Toggle switch on provider profile
 * - Amber banner visible when not accepting
 * - Amber banner hidden when accepting (default)
 */

test.describe('Accepting New Customers', () => {
  let providerId: string

  test.beforeAll(async () => {
    await cleanupSpecData(SPEC_TAG)
    const base = await getBaseEntities()
    providerId = base.providerId

    // Seed a completed booking so the test customer counts as existing
    await seedBooking({
      specTag: SPEC_TAG,
      status: 'completed',
      daysFromNow: -10,
      horseName: 'E2E AcceptingHorse',
    })

    // Ensure provider is accepting (reset state)
    await prisma.provider.update({
      where: { id: providerId },
      data: { acceptingNewCustomers: true },
    })
  })

  test.afterAll(async () => {
    await cleanupSpecData(SPEC_TAG)
    // Always restore accepting state
    const base = await getBaseEntities()
    await prisma.provider.update({
      where: { id: base.providerId },
      data: { acceptingNewCustomers: true },
    })
  })

  test('should toggle acceptingNewCustomers on provider profile', async ({ page }) => {
    // Reset rate limits to avoid 429 after many preceding tests
    await page.request.post('/api/test/reset-rate-limit').catch(() => {})

    // Login as provider
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('provider@example.com')
    await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!')
    await page.getByRole('button', { name: /logga in/i }).click()
    await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 10000 })

    // Go to provider profile
    await page.goto('/provider/profile')
    await expect(page.getByText('Bokningsinställningar', { exact: true })).toBeVisible({ timeout: 10000 })

    // Find the switch
    const toggle = page.getByLabel('Ta emot nya kunder')
    await expect(toggle).toBeVisible()

    // Should be checked by default (accepting)
    await expect(toggle).toBeChecked()

    // Turn off -- disable accepting new customers
    await toggle.click()
    await expect(page.getByText(/bara emot befintliga kunder/i)).toBeVisible({ timeout: 5000 })

    // Wait for first toast to disappear before toggling again
    await expect(page.getByText(/bara emot befintliga kunder/i)).not.toBeVisible({ timeout: 6000 })

    // Turn on again -- accept new customers
    await toggle.click()
    await expect(page.getByText(/du tar nu emot nya kunder/i)).toBeVisible({ timeout: 5000 })
  })

  test('should show amber banner when provider not accepting new customers', async ({ page }) => {
    await page.request.post('/api/test/reset-rate-limit').catch(() => {})

    // Set provider to not accepting via Prisma
    await prisma.provider.update({
      where: { id: providerId },
      data: { acceptingNewCustomers: false },
    })

    // Login as customer
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('test@example.com')
    await page.getByLabel('Lösenord', { exact: true }).fill('TestPassword123!')
    await page.getByRole('button', { name: /logga in/i }).click()
    await expect(page).toHaveURL(/\/(dashboard|providers)/, { timeout: 10000 })

    // Navigate to provider detail page
    await page.goto(`/providers/${providerId}`)

    // Amber banner should be visible
    await expect(
      page.getByText('Denna leverantör tar för närvarande bara emot bokningar från befintliga kunder')
    ).toBeVisible({ timeout: 10000 })
  })

  test('should NOT show amber banner when accepting (default)', async ({ page }) => {
    await page.request.post('/api/test/reset-rate-limit').catch(() => {})

    // Set provider to accepting via Prisma
    await prisma.provider.update({
      where: { id: providerId },
      data: { acceptingNewCustomers: true },
    })

    // Login as customer
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('test@example.com')
    await page.getByLabel('Lösenord', { exact: true }).fill('TestPassword123!')
    await page.getByRole('button', { name: /logga in/i }).click()
    await expect(page).toHaveURL(/\/(dashboard|providers)/, { timeout: 10000 })

    // Navigate to provider detail page
    await page.goto(`/providers/${providerId}`)

    // Wait for page to load
    await expect(page.getByText('Test Stall AB')).toBeVisible({ timeout: 10000 })

    // Amber banner should NOT be visible
    await expect(
      page.getByText('Denna leverantör tar för närvarande bara emot bokningar från befintliga kunder')
    ).not.toBeVisible()
  })
})
