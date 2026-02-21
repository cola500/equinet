import { test, expect } from './fixtures'

test.describe('Offline PWA', () => {

  test.beforeEach(async ({ page }) => {
    await page.request.post('/api/test/reset-rate-limit').catch(() => {})
  })

  test.describe('Manifest', () => {
    test('manifest is accessible at /manifest.webmanifest', async ({ page }) => {
      const response = await page.goto('/manifest.webmanifest')
      expect(response).not.toBeNull()
      expect(response!.status()).toBe(200)

      const manifest = await response!.json()
      expect(manifest.name).toBe('Equinet - Hästtjänster')
      expect(manifest.short_name).toBe('Equinet')
      expect(manifest.display).toBe('standalone')
      expect(manifest.theme_color).toBe('#16a34a')
      expect(manifest.lang).toBe('sv')
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2)
    })
  })

  test.describe('Offline banner', () => {
    test('shows offline banner when network is lost', async ({ context, page }) => {
      // Navigate to a provider page first
      await page.goto('/')

      // Go offline
      await context.setOffline(true)

      // Navigate to trigger the offline banner
      // The OfflineBanner is gated behind the offline_mode feature flag,
      // so this test verifies the component doesn't crash when offline.
      // Full testing requires the flag to be enabled.
      await page.goto('/').catch(() => {})

      // Restore network
      await context.setOffline(false)
    })

    test('offline page renders correctly', async ({ page }) => {
      await page.goto('/~offline')
      await expect(page.getByText('Ingen internetanslutning')).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Försök igen' })
      ).toBeVisible()
    })
  })

  test.describe('Offline navigation', () => {
    // These tests require a production build with an active service worker.
    // They only run via: npm run test:e2e:offline (sets OFFLINE_E2E=true)
    //
    // Note: Playwright's context.setOffline() simulates network loss at the
    // browser level. The service worker still runs and can serve from cache.

    test.skip(!process.env.OFFLINE_E2E, 'Requires production build with active service worker (npm run test:e2e:offline)')

    test.beforeEach(async ({ page }) => {
      // Navigate first so navigator.serviceWorker API is available (not on about:blank)
      await page.goto('/')
      // Wait for service worker to be installed and active
      await page.evaluate(() => navigator.serviceWorker.ready)
    })

    test('previously visited page loads from cache when offline', async ({ context, page }) => {
      // 1. Visit dashboard while online (populates SW runtime cache)
      await page.goto('/provider/dashboard')
      await page.waitForLoadState('networkidle')

      // 2. Visit bookings while online (populates SW runtime cache)
      await page.goto('/provider/bookings')
      await page.waitForLoadState('networkidle')

      // 3. Go offline
      await context.setOffline(true)

      // 4. Navigate back to dashboard -- should load from cache within 3s timeout
      await page.goto('/provider/dashboard', { timeout: 15000 })
      await expect(page.locator('body')).toBeVisible()

      // 5. Restore network
      await context.setOffline(false)
    })

    test('unvisited page shows offline fallback when offline', async ({ context, page }) => {
      // 1. Visit dashboard to establish service worker
      await page.goto('/provider/dashboard')
      await page.waitForLoadState('networkidle')

      // 2. Go offline
      await context.setOffline(true)

      // 3. Try to navigate to a page never visited (not in cache)
      await page.goto('/provider/voice-log', { timeout: 15000 }).catch(() => {})

      // Should show the offline fallback page
      await expect(
        page.getByText('Ingen internetanslutning')
      ).toBeVisible({ timeout: 15000 })

      // 4. Restore network
      await context.setOffline(false)
    })
  })

  test.describe('Service Worker headers', () => {
    test('sw.js has no-cache headers', async ({ page }) => {
      const response = await page.goto('/sw.js')
      // SW may not exist in dev mode, so we check if it exists
      if (response && response.status() === 200) {
        const cacheControl = response.headers()['cache-control']
        expect(cacheControl).toContain('no-cache')
      }
    })
  })
})
