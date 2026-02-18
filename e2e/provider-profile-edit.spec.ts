import { test, expect } from './fixtures'
import { prisma } from './fixtures'
import { getBaseEntities } from './setup/seed-helpers'

/**
 * E2E Tests for Provider Profile Editing
 *
 * Covers:
 * - Personal info edit (firstName, lastName, phone)
 * - Business info edit (businessName, description, etc.)
 * - Cancel flows (restore original values)
 * - Smoke: page renders with correct sections
 *
 * NOTE: CardTitle renders as <div>, not <h1>-<h6>, so we use getByText instead of getByRole('heading').
 */

// ─── Helpers ─────────────────────────────────────────────────────

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

/**
 * Navigate to profile and wait for content to load.
 * "Min profil" is the h1 heading, everything else is CardTitle (<div>).
 */
async function gotoProfileAndWait(page: import('@playwright/test').Page) {
  await page.goto('/provider/profile')
  await expect(page.getByRole('heading', { name: /min profil/i })).toBeVisible({ timeout: 10000 })
  // Wait for SWR profile data to load (Redigera buttons appear when data loads)
  await expect(page.getByRole('button', { name: /redigera/i }).first()).toBeVisible({ timeout: 10000 })
}

/**
 * Find a card section by its CardTitle text and return a scoped locator.
 * CardTitle is a <div> inside a CardHeader.
 */
function getCardByTitle(page: import('@playwright/test').Page, titleText: string) {
  // Go up from the title div -> CardHeader -> Card
  return page.getByText(titleText, { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"rounded-lg") or contains(@class,"border")]').first()
}

// ─── Test suite ──────────────────────────────────────────────────

test.describe('Provider Profile Edit', () => {
  // Save original values to restore after tests
  let originalUser: { firstName: string; lastName: string; phone: string | null }
  let originalProvider: { businessName: string; description: string | null }

  test.beforeAll(async () => {
    const base = await getBaseEntities()

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: base.providerUserId },
      select: { firstName: true, lastName: true, phone: true },
    })
    originalUser = user

    const provider = await prisma.provider.findUniqueOrThrow({
      where: { id: base.providerId },
      select: { businessName: true, description: true },
    })
    originalProvider = provider
  })

  test.afterAll(async () => {
    // Restore original values
    const base = await getBaseEntities()

    await prisma.user.update({
      where: { id: base.providerUserId },
      data: {
        firstName: originalUser.firstName,
        lastName: originalUser.lastName,
        phone: originalUser.phone,
      },
    })

    await prisma.provider.update({
      where: { id: base.providerId },
      data: {
        businessName: originalProvider.businessName,
        description: originalProvider.description,
      },
    })
  })

  test('1: Smoke - profile page renders with correct sections', async ({ page }) => {
    await loginAsProvider(page)
    await gotoProfileAndWait(page)

    // h1 heading
    await expect(page.getByRole('heading', { name: /min profil/i })).toBeVisible()

    // CardTitles (div elements, not headings)
    await expect(page.getByText('Personlig information', { exact: true })).toBeVisible()
    await expect(page.getByText('Företagsinformation', { exact: true })).toBeVisible()
    await expect(page.getByText('Bokningsinställningar', { exact: true })).toBeVisible()
  })

  // ─── Personal info ─────────────────────────────────────────────

  test.describe('Personal information', () => {

    test('2: Edit button opens form with firstName, lastName, phone', async ({ page }) => {
      await loginAsProvider(page)
      await gotoProfileAndWait(page)

      // Scroll to personal info section and click its Redigera button
      const personalTitle = page.getByText('Personlig information', { exact: true })
      await personalTitle.scrollIntoViewIfNeeded()

      // The first "Redigera" button on the page is in the personal info card
      const personalCard = getCardByTitle(page, 'Personlig information')
      await personalCard.getByRole('button', { name: /redigera/i }).click()

      // Form fields should now be visible
      await expect(page.getByLabel('Förnamn *')).toBeVisible()
      await expect(page.getByLabel('Efternamn *')).toBeVisible()
      await expect(page.getByLabel('Telefon')).toBeVisible()
    })

    test('3: Save updated phone shows success toast', async ({ page }) => {
      await loginAsProvider(page)
      await gotoProfileAndWait(page)

      // Open edit mode
      const personalCard = getCardByTitle(page, 'Personlig information')
      await personalCard.getByRole('button', { name: /redigera/i }).click()

      // Update phone
      const phoneInput = page.getByLabel('Telefon')
      await phoneInput.clear()
      await phoneInput.fill('070-999 88 77')

      // Save
      await resetRateLimit(page)
      await page.getByRole('button', { name: /spara ändringar/i }).first().click()

      // Success toast
      await expect(
        page.getByText(/personlig information uppdaterad/i)
      ).toBeVisible({ timeout: 5000 })

      // Should exit edit mode - "Redigera" button should reappear
      await expect(personalCard.getByRole('button', { name: /redigera/i })).toBeVisible({ timeout: 5000 })
    })

    test('4: Cancel restores original values', async ({ page }) => {
      await loginAsProvider(page)
      await gotoProfileAndWait(page)

      // Open edit mode
      const personalCard = getCardByTitle(page, 'Personlig information')
      await personalCard.getByRole('button', { name: /redigera/i }).click()

      // Get original first name value
      const firstNameInput = page.getByLabel('Förnamn *')
      const originalValue = await firstNameInput.inputValue()

      // Modify it
      await firstNameInput.clear()
      await firstNameInput.fill('ÄNDRAT_NAMN_TEST')

      // Cancel
      await personalCard.getByRole('button', { name: /avbryt/i }).click()

      // Should be back in view mode with original value
      await expect(personalCard.getByRole('button', { name: /redigera/i })).toBeVisible({ timeout: 5000 })

      // The displayed name should be the original, not the modified one
      const pageText = await personalCard.textContent()
      expect(pageText).not.toContain('ÄNDRAT_NAMN_TEST')
      // Original should still be shown
      expect(pageText).toContain(originalValue)
    })
  })

  // ─── Business info ─────────────────────────────────────────────

  test.describe('Business information', () => {

    test('5: Edit button opens business form', async ({ page }) => {
      await loginAsProvider(page)
      await gotoProfileAndWait(page)

      // Scroll to business info section
      const businessTitle = page.getByText('Företagsinformation', { exact: true })
      await businessTitle.scrollIntoViewIfNeeded()

      const businessCard = getCardByTitle(page, 'Företagsinformation')
      await businessCard.getByRole('button', { name: /redigera/i }).click()

      // Form fields should be visible
      await expect(page.getByLabel('Företagsnamn *')).toBeVisible()
      await expect(page.getByLabel('Beskrivning')).toBeVisible()
    })

    test('6: Save updated description shows success toast', async ({ page }) => {
      await loginAsProvider(page)
      await gotoProfileAndWait(page)

      // Scroll and open edit mode
      await page.getByText('Företagsinformation', { exact: true }).scrollIntoViewIfNeeded()
      const businessCard = getCardByTitle(page, 'Företagsinformation')
      await businessCard.getByRole('button', { name: /redigera/i }).click()

      // Update description
      const descInput = page.getByLabel('Beskrivning')
      await descInput.clear()
      await descInput.fill('E2E test description - uppdaterad')

      // Save
      await resetRateLimit(page)
      await businessCard.getByRole('button', { name: /spara ändringar/i }).click()

      // Success toast
      await expect(
        page.getByText(/företagsinformation uppdaterad/i)
      ).toBeVisible({ timeout: 5000 })
    })

    test('7: Cancel on business info preserves original', async ({ page }) => {
      await loginAsProvider(page)
      await gotoProfileAndWait(page)

      // Scroll and open edit mode
      await page.getByText('Företagsinformation', { exact: true }).scrollIntoViewIfNeeded()
      const businessCard = getCardByTitle(page, 'Företagsinformation')
      await businessCard.getByRole('button', { name: /redigera/i }).click()

      // Get original business name
      const nameInput = page.getByLabel('Företagsnamn *')
      const originalName = await nameInput.inputValue()

      // Modify it
      await nameInput.clear()
      await nameInput.fill('ÄNDRAT_FÖRETAG_TEST')

      // Cancel
      await businessCard.getByRole('button', { name: /avbryt/i }).click()

      // Should be back in view mode
      await expect(businessCard.getByRole('button', { name: /redigera/i })).toBeVisible({ timeout: 5000 })

      // Verify the modified name is NOT displayed
      const pageText = await businessCard.textContent()
      expect(pageText).not.toContain('ÄNDRAT_FÖRETAG_TEST')
      // Original name should still be there
      expect(pageText).toContain(originalName)
    })
  })
})
