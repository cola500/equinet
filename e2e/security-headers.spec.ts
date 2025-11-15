import { test, expect } from '@playwright/test'

test.describe('Security Headers', () => {
  test('should have all required security headers', async ({ page }) => {
    const response = await page.goto('/')
    expect(response).not.toBeNull()

    const headers = response!.headers()

    // Content Security Policy
    expect(headers['content-security-policy']).toBeDefined()
    expect(headers['content-security-policy']).toContain("default-src 'self'")
    expect(headers['content-security-policy']).toContain("object-src 'none'")
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")

    // Clickjacking protection
    expect(headers['x-frame-options']).toBe('DENY')

    // MIME type protection
    expect(headers['x-content-type-options']).toBe('nosniff')

    // Referrer policy
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')

    // Permissions policy
    expect(headers['permissions-policy']).toBeDefined()
    expect(headers['permissions-policy']).toContain('camera=()')
    expect(headers['permissions-policy']).toContain('microphone=()')
    expect(headers['permissions-policy']).toContain('geolocation=()')
    expect(headers['permissions-policy']).toContain('payment=()')
    expect(headers['permissions-policy']).toContain('usb=()')
    expect(headers['permissions-policy']).toContain('interest-cohort=()') // Block FLoC

    // XSS Protection
    expect(headers['x-xss-protection']).toBe('1; mode=block')

    // Cross-Origin Policies (Spectre protection)
    expect(headers['cross-origin-opener-policy']).toBe('same-origin')
    expect(headers['cross-origin-resource-policy']).toBe('same-origin')
    expect(headers['cross-origin-embedder-policy']).toBe('require-corp')
  })

  test('CSP should allow self-hosted fonts', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response!.headers()
    const csp = headers['content-security-policy']

    // Next.js Google Fonts are self-hosted, so 'self' and 'data:' should be enough
    expect(csp).toContain("font-src 'self' data:")
  })

  test('CSP should allow blob images for uploads', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response!.headers()
    const csp = headers['content-security-policy']

    // blob: needed for client-side image processing
    expect(csp).toContain('blob:')
  })

  test('should block iframe embedding (clickjacking protection)', async ({ page }) => {
    // Test that X-Frame-Options prevents embedding
    const response = await page.goto('/')
    const headers = response!.headers()

    expect(headers['x-frame-options']).toBe('DENY')

    // CSP also blocks framing
    const csp = headers['content-security-policy']
    expect(csp).toContain("frame-ancestors 'none'")
  })

  test('CSP should allow unsafe-eval in development', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response!.headers()
    const csp = headers['content-security-policy']

    // Development allows unsafe-eval for React DevTools
    // This test verifies we have it in dev (we run E2E in dev mode)
    expect(csp).toContain('unsafe-eval')
  })

  test('CSP should NOT have upgrade-insecure-requests in development', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response!.headers()
    const csp = headers['content-security-policy']

    // upgrade-insecure-requests only makes sense in production with HTTPS
    // In dev (HTTP), we shouldn't have it
    expect(csp).not.toContain('upgrade-insecure-requests')
  })

  test('should NOT have HSTS in development', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response!.headers()

    // HSTS not needed in development (no HTTPS)
    expect(headers['strict-transport-security']).toBeUndefined()
  })
})
