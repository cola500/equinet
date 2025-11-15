import { test, expect } from '@playwright/test'

/**
 * E2E Tests för Retry-funktionalitet (F-3.3)
 *
 * Testar att ErrorState-komponenten och useRetry hook fungerar korrekt
 * när nätverksfel eller API-fel inträffar.
 */

test.describe('Error Retry Functionality', () => {
  test.describe('Provider Dashboard - Data Fetching Errors', () => {
    test('should show error state and retry button when data fetch fails', async ({ page }) => {
      // Blocka API-anrop för att simulera nätverksfel
      await page.route('**/api/services', route => route.abort())
      await page.route('**/api/bookings', route => route.abort())

      // Logga in som provider först
      await page.goto('/login')
      await page.fill('[name="email"]', 'test.provider@example.com')
      await page.fill('[name="password"]', 'Test123!')
      await page.click('button[type="submit"]')

      // Vänta på redirect till dashboard
      await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 10000 })

      // Vänta lite så API-anrop har tid att faila
      await page.waitForTimeout(2000)

      // Verifiera att error state visas
      await expect(page.getByTestId('error-state')).toBeVisible({ timeout: 5000 })
      await expect(page.getByText(/kunde inte hämta data/i)).toBeVisible()

      // Verifiera att retry-knappen finns
      const retryButton = page.getByTestId('retry-button')
      await expect(retryButton).toBeVisible()
      await expect(retryButton).toHaveText(/försök igen/i)

      // Stoppa blockeringen och klicka retry
      await page.unroute('**/api/services')
      await page.unroute('**/api/bookings')

      // Klicka på retry
      await retryButton.click()

      // Verifiera att laddning visas
      await expect(retryButton).toHaveText(/försöker igen/i)
      await expect(retryButton).toBeDisabled()

      // Efter retry borde dashboarden laddas korrekt
      await expect(page.getByText(/välkommen tillbaka/i)).toBeVisible({ timeout: 10000 })
      await expect(page.getByTestId('error-state')).not.toBeVisible()
    })

    test('should show max retries reached after 3 failed attempts', async ({ page }) => {
      // Blocka API-anrop permanent
      await page.route('**/api/services', route => route.abort())
      await page.route('**/api/bookings', route => route.abort())

      await page.goto('/login')
      await page.fill('[name="email"]', 'test.provider@example.com')
      await page.fill('[name="password"]', 'Test123!')
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 10000 })
      await page.waitForTimeout(2000)

      // Retry 3 gånger
      for (let i = 1; i <= 3; i++) {
        const retryButton = page.getByTestId('retry-button')
        await expect(retryButton).toBeVisible({ timeout: 5000 })

        // Verifiera retry count
        const retryCountText = page.getByTestId('retry-count')
        if (i > 0) {
          await expect(retryCountText).toHaveText(new RegExp(`försök ${i} av 3`, 'i'))
        }

        await retryButton.click()
        await page.waitForTimeout(1500) // Vänta på retry att slutföras
      }

      // Efter 3 försök ska max retries nås
      await expect(page.getByTestId('max-retries-reached')).toBeVisible({ timeout: 5000 })
      await expect(page.getByText(/maximalt antal försök uppnått/i)).toBeVisible()

      // Reload-knapp ska visas istället
      await expect(page.getByRole('button', { name: /ladda om sidan/i })).toBeVisible()

      // Contact support-knapp ska visas
      await expect(page.getByRole('link', { name: /kontakta support/i })).toBeVisible()
    })
  })

  test.describe('Login Page - Authentication Errors', () => {
    test('should show error state for invalid credentials', async ({ page }) => {
      await page.goto('/login')

      // Försök logga in med felaktiga uppgifter
      await page.fill('[name="email"]', 'wrong@example.com')
      await page.fill('[name="password"]', 'WrongPassword123!')
      await page.click('button[type="submit"]')

      // Vänta på att inloggning failar
      await page.waitForTimeout(1500)

      // Första gången visas inte ErrorState (retryCount = 0)
      // Men efter första retry ska det visas
      // TODO: Detta kan behöva justeras beroende på implementation
    })
  })

  test.describe('Register Page - Registration Errors', () => {
    test('should show error state when registration fails', async ({ page }) => {
      // Blocka registrerings-API
      await page.route('**/api/auth/register', route => route.abort())

      await page.goto('/register')

      // Fyll i formuläret
      await page.fill('[name="firstName"]', 'Test')
      await page.fill('[name="lastName"]', 'User')
      await page.fill('[name="email"]', `test${Date.now()}@example.com`)
      await page.fill('[name="password"]', 'Test123!')

      // Submitta formuläret
      await page.click('button[type="submit"]')

      // Vänta på att error state visas
      await page.waitForTimeout(1500)

      // Verifiera error state
      await expect(page.getByTestId('error-state')).toBeVisible({ timeout: 5000 })
      await expect(page.getByText(/kunde inte skapa konto/i)).toBeVisible()

      // Verifiera retry-knapp
      const retryButton = page.getByTestId('retry-button')
      await expect(retryButton).toBeVisible()

      // Unblock API och retry
      await page.unroute('**/api/auth/register')
      await retryButton.click()

      // Borde redirecta till login efter lyckad registrering
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    })
  })
})
