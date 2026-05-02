import { test, expect } from './fixtures'

/**
 * Demo flow consistency smoke.
 *
 * Verifies that the demo provider login + 5 navigation flows:
 *   - Don't leak "DEMO-SEED" tag to UI
 *   - Don't show "Test Testsson" (legacy seed user)
 *   - Don't show the "Registrera"-button in Header
 *
 * Prerequisites: setup-projektet seedar provider@example.com med E2E-data,
 * och demo-seed har körts (npm run db:seed:demo:reset). Vi inloggar som
 * den seeded provider och navigerar fem flikar.
 *
 * NOTE: Specen är medvetet tunn — den ska inte testa UX-detaljer eller
 * affärslogik. Bara konsistens-smoke. Snabb (<30s lokalt).
 */

const DEMO_EMAIL = 'provider@example.com'
const DEMO_PASSWORD = 'ProviderPass123!'

const FORBIDDEN_STRINGS = ['DEMO-SEED', 'Test Testsson']

const NAV_TARGETS: Array<{ path: string; heading?: RegExp }> = [
  { path: '/provider/dashboard' },
  { path: '/provider/calendar' },
  { path: '/provider/bookings' },
  { path: '/provider/customers' },
  { path: '/provider/services' },
]

test.describe('Demo flow consistency', () => {
  test.beforeEach(async ({ page }) => {
    // Reset rate limiters (vanliga E2E-mönstret från e2e.md)
    await page.request.post('/api/test/reset-rate-limit').catch(() => {})
  })

  test.skip(
    (_args, testInfo) => testInfo.project.name === 'mobile',
    'Demo-flow körs bara desktop — mobil har egen layout med BottomTabBar'
  )

  test('login + 5 nav-flikar utan dev/seed-läckage', async ({ page }) => {
    // 1. Login
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(DEMO_EMAIL)
    await page.getByLabel(/lösenord/i).fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: /^logga in$/i }).click()

    await expect(page).toHaveURL(/\/(provider|dashboard)/, { timeout: 15_000 })

    // 2. Navigera 5 flikar och kontrollera per sida
    for (const target of NAV_TARGETS) {
      await page.goto(target.path)
      await page.waitForLoadState('domcontentloaded')

      // Ska inte ha redirectats till /login (= session OK)
      await expect(page).not.toHaveURL(/\/login/)

      // Hämta hela DOM-textinnehållet (en gång per sida)
      const bodyText = await page.locator('body').innerText()

      for (const forbidden of FORBIDDEN_STRINGS) {
        expect(
          bodyText,
          `${target.path} läcker "${forbidden}" till UI`
        ).not.toContain(forbidden)
      }

      // "Registrera"-knappen ska inte finnas i Header (demo döljer den)
      const registerLink = page.getByRole('link', { name: /^registrera$/i })
      await expect(registerLink).toHaveCount(0)
    }
  })
})
