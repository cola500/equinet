import { test, expect, prisma } from './fixtures'
import { getBaseEntities } from './setup/seed-helpers'

/**
 * E2E: Customer Invite Flow
 *
 * Tests that a provider can send an invitation to a manually added (ghost) customer.
 * Requires: FEATURE_CUSTOMER_INVITE=true (set in playwright.config.ts webServer.env)
 */

const SPEC_TAG = 'customer-invite'
const GHOST_EMAIL = `invite-test-${Date.now()}@example.com`

async function syncClientFlags(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('featureflags-changed'))
  })
  await page.waitForTimeout(300)
}

async function loginAsProvider(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('provider@example.com')
  await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!')
  await page.getByRole('button', { name: /logga in/i }).click()
  await expect(page.getByRole('heading', { name: /välkommen/i })).toBeVisible({ timeout: 15000 })
  await syncClientFlags(page)
}

test.describe('Customer Invite Flow', () => {
  let ghostUserId: string

  test.beforeAll(async () => {
    const base = await getBaseEntities()

    // Create ghost customer with real email (not sentinel)
    const ghostUser = await prisma.user.create({
      data: {
        email: GHOST_EMAIL,
        firstName: 'Inbjudan',
        lastName: `Test-${SPEC_TAG}`,
        phone: '0701234567',
        userType: 'customer',
        isManualCustomer: true,
        emailVerified: false,
        customerNotes: `E2E-spec:${SPEC_TAG}`,
      },
    })
    ghostUserId = ghostUser.id

    // Link ghost to provider's register
    await prisma.providerCustomer.create({
      data: {
        providerId: base.providerId,
        customerId: ghostUser.id,
      },
    })
  })

  test.beforeEach(async ({ page }) => {
    await page.request.post('/api/test/reset-rate-limit').catch(() => {})
  })

  test('provider can send invite to manually added customer', async ({ page }) => {
    await loginAsProvider(page)

    // Navigate to customers
    await page.goto('/provider/customers')
    await page.waitForLoadState('domcontentloaded')
    await syncClientFlags(page)

    // Find the ghost customer
    await expect(page.getByText('Inbjudan')).toBeVisible({ timeout: 10000 })

    // Click "Skicka inbjudan" button
    const inviteButton = page.getByRole('button', { name: /skicka inbjudan/i })
    await expect(inviteButton).toBeVisible({ timeout: 5000 })
    await inviteButton.click()

    // Verify success: button text changes to "Inbjudan skickad"
    await expect(page.getByRole('button', { name: /inbjudan skickad/i })).toBeVisible({ timeout: 10000 })
  })

  test.afterAll(async () => {
    // Cleanup: delete ghost user and linked data
    if (ghostUserId) {
      await prisma.providerCustomer.deleteMany({
        where: { customerId: ghostUserId },
      })
      await prisma.customerInviteToken.deleteMany({
        where: { userId: ghostUserId },
      })
      await prisma.user.delete({
        where: { id: ghostUserId },
      }).catch(() => {})
    }
  })
})
