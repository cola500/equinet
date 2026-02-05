import { test, expect } from './fixtures'

test.describe('Manual Booking Dialog', () => {
  test.beforeEach(async ({ page }) => {
    // Login as provider
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('provider@example.com')
    await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!')
    await page.getByRole('button', { name: /logga in/i }).click()
    await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 10000 })

    // Navigate to calendar
    await page.goto('/provider/calendar')
    await page.waitForLoadState('networkidle')
  })

  test('happy path: create manual booking with new customer (ghost user)', async ({ page }) => {
    // Open dialog
    await page.getByRole('button', { name: /\+ Bokning/i }).click()
    await expect(page.getByText('Ny manuell bokning')).toBeVisible({ timeout: 5000 })

    // Select first service from dropdown
    const serviceSelect = page.locator('#service')
    await serviceSelect.selectOption({ index: 1 })

    // Set date (2 weeks from now)
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 14)
    const dateStr = futureDate.toISOString().split('T')[0]
    await page.locator('#date').fill(dateStr)

    // Set start time
    await page.locator('#start').selectOption('10:00')

    // Switch to "Ny kund" mode
    await page.getByRole('button', { name: /ny kund/i }).click()

    // Fill in customer name and phone
    await page.getByPlaceholder('Namn *').fill(`E2E Testperson ${Date.now()}`)
    await page.getByPlaceholder('Telefon').fill('0701234567')

    // Submit
    await page.getByRole('button', { name: /skapa bokning/i }).click()

    // Verify success toast and dialog closes
    await expect(page.getByText('Bokning skapad!')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Ny manuell bokning')).toBeHidden({ timeout: 5000 })
  })

  test('validation error: missing customer name in manual mode', async ({ page }) => {
    // Open dialog
    await page.getByRole('button', { name: /\+ Bokning/i }).click()
    await expect(page.getByText('Ny manuell bokning')).toBeVisible({ timeout: 5000 })

    // Select first service
    const serviceSelect = page.locator('#service')
    await serviceSelect.selectOption({ index: 1 })

    // Set date and time
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 14)
    await page.locator('#date').fill(futureDate.toISOString().split('T')[0])
    await page.locator('#start').selectOption('10:00')

    // Switch to "Ny kund" but leave name empty
    await page.getByRole('button', { name: /ny kund/i }).click()

    // Submit without name
    await page.getByRole('button', { name: /skapa bokning/i }).click()

    // Verify error toast and dialog stays open
    await expect(page.getByText('Ange kundens namn')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Ny manuell bokning')).toBeVisible()
  })
})
