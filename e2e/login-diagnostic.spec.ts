/**
 * Diagnostic test: isolates login flow to find why E2E login fails in CI.
 * Temporary -- remove after root cause is found.
 */
import { test, expect } from './fixtures'

test('login diagnostic: step-by-step observation', async ({ page }) => {
  // 1. Capture all network requests to Supabase auth
  const authRequests: string[] = []
  page.on('response', (response) => {
    const url = response.url()
    if (url.includes('54321') || url.includes('supabase') || url.includes('/auth/')) {
      authRequests.push(`${response.status()} ${response.request().method()} ${url}`)
    }
  })

  // 2. Capture console errors
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  // 3. Navigate to login
  await page.goto('/login')
  await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 10000 })
  console.log('DIAG: login page loaded')

  // 4. Fill credentials
  await page.getByLabel(/email/i).fill('test@example.com')
  await page.getByLabel('Lösenord', { exact: true }).fill('TestPassword123!')
  console.log('DIAG: credentials filled')

  // 5. Click login and wait for navigation or error
  await page.getByRole('button', { name: /logga in/i }).click()
  console.log('DIAG: login button clicked')

  // 6. Wait 5s and observe what happened
  await page.waitForTimeout(5000)

  const currentUrl = page.url()
  console.log(`DIAG: current URL after 5s: ${currentUrl}`)

  // 7. Check for visible error message
  const errorVisible = await page.getByText(/ogiltig|error|fel/i).isVisible().catch(() => false)
  console.log(`DIAG: error message visible: ${errorVisible}`)

  if (errorVisible) {
    const errorText = await page.getByText(/ogiltig|error|fel/i).textContent().catch(() => 'unknown')
    console.log(`DIAG: error text: ${errorText}`)
  }

  // 8. Log all auth-related network requests
  console.log(`DIAG: auth requests (${authRequests.length}):`)
  for (const req of authRequests) {
    console.log(`  ${req}`)
  }

  // 9. Log console errors
  console.log(`DIAG: console errors (${consoleErrors.length}):`)
  for (const err of consoleErrors) {
    console.log(`  ${err}`)
  }

  // 10. Check page content for clues
  const bodyText = await page.locator('body').textContent().catch(() => '')
  if (currentUrl.includes('/login')) {
    // Still on login -- extract visible text for clues
    const formArea = await page.locator('form').textContent().catch(() => 'no form found')
    console.log(`DIAG: form content: ${formArea?.substring(0, 500)}`)
  }

  // This test always passes -- it's for observation only
  console.log('DIAG: test complete')
})
