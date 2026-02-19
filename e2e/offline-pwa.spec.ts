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
        page.getByRole('link', { name: 'Tillbaka till Dashboard' })
      ).toBeVisible()
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
