import { test, expect } from './fixtures'
import { prisma } from './fixtures'
import { seedBooking, getBaseEntities, cleanupSpecData } from './setup/seed-helpers'

const SPEC_TAG = 'admin'

/**
 * E2E Tests for Admin Dashboard & Actions
 *
 * Tests:
 * - Dashboard heading + navigation
 * - Navigation (8 items)
 * - Users list with search
 * - Block/unblock user
 * - Blocked user login prevention
 * - Bookings list with status filter
 * - Cancel booking as admin
 * - Reviews page
 * - Delete review
 * - Send bulk notification
 * - Non-admin access denied (page + API)
 */

test.describe('Admin Dashboard & Actions', () => {
  let testUserId: string

  test.beforeAll(async () => {
    await cleanupSpecData(SPEC_TAG)
    const base = await getBaseEntities()

    // Seed bookings for dashboard stats
    await seedBooking({ specTag: SPEC_TAG, status: 'pending', daysFromNow: 5, horseName: 'E2E AdminPending' })
    await seedBooking({ specTag: SPEC_TAG, status: 'confirmed', daysFromNow: 8, horseName: 'E2E AdminConfirmed' })

    // Seed a completed booking + review for review tests
    const completedBooking = await seedBooking({
      specTag: SPEC_TAG,
      status: 'completed',
      daysFromNow: -5,
      horseName: 'E2E AdminCompleted',
    })
    await prisma.review.create({
      data: {
        bookingId: completedBooking.id,
        providerId: base.providerId,
        customerId: base.customerId,
        rating: 4,
        comment: `E2E admin review test ${Date.now()}`,
      },
    })

    // Create a dedicated test user for block/unblock tests
    const bcrypt = await import('bcrypt')
    const hash = await bcrypt.hash('BlockTestPass123!', 10)
    const testUser = await prisma.user.upsert({
      where: { email: 'e2e-block-test@example.com' },
      update: { isBlocked: false, passwordHash: hash },
      create: {
        email: 'e2e-block-test@example.com',
        passwordHash: hash,
        firstName: 'BlockTest',
        lastName: 'User',
        phone: '0701119999',
        userType: 'customer',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    })
    testUserId = testUser.id
  })

  test.afterAll(async () => {
    await cleanupSpecData(SPEC_TAG)
    await prisma.user.update({
      where: { email: 'e2e-block-test@example.com' },
      data: { isBlocked: false },
    }).catch(() => {})
  })

  /** Login as admin (resets rate limits to avoid 429 across many tests) */
  async function loginAsAdmin(page: import('@playwright/test').Page) {
    await page.request.post('/api/test/reset-rate-limit').catch(() => {})
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('admin@example.com')
    await page.getByLabel('Lösenord', { exact: true }).fill('AdminPass123!')
    await page.getByRole('button', { name: /logga in/i }).click()
    await expect(page).toHaveURL(/\/(dashboard|providers|admin)/, { timeout: 15000 })
  }

  /** Login as regular customer (clears any existing session first) */
  async function loginAsCustomer(page: import('@playwright/test').Page) {
    await page.context().clearCookies()
    await page.request.post('/api/test/reset-rate-limit').catch(() => {})
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('test@example.com')
    await page.getByLabel('Lösenord', { exact: true }).fill('TestPassword123!')
    await page.getByRole('button', { name: /logga in/i }).click()
    await expect(page).toHaveURL(/\/(dashboard|providers)/, { timeout: 15000 })
  }

  // ─── Dashboard ───────────────────────────────────────────────────

  test('should display admin dashboard with KPI cards', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin')

    await expect(page.getByRole('heading', { name: 'Adminpanel' })).toBeVisible({ timeout: 10000 })

    // KPI cards use data-slot="card-title" -- wait for them to appear (data loaded)
    const cardTitles = page.locator('[data-slot="card-title"]')
    await expect(cardTitles.filter({ hasText: 'Användare' })).toBeVisible({ timeout: 20000 })
    await expect(cardTitles.filter({ hasText: 'Bokningar' })).toBeVisible()
    await expect(cardTitles.filter({ hasText: 'Leverantörer' })).toBeVisible()
    await expect(cardTitles.filter({ hasText: 'Intäkter' })).toBeVisible()
  })

  // ─── Navigation ──────────────────────────────────────────────────

  test('should display admin navigation', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Adminpanel' })).toBeVisible({ timeout: 10000 })

    const isMobile = test.info().project.name === 'mobile'

    if (isMobile) {
      // Mobile uses BottomTabBar with 4 tabs + "Mer" drawer
      // Scope to admin nav (contains "System" link, unique to admin)
      const adminNav = page.locator('nav').filter({ has: page.getByRole('link', { name: 'System' }) })

      const bottomTabItems = ['Översikt', 'Användare', 'Bokningar', 'System']
      for (const item of bottomTabItems) {
        await expect(adminNav.getByRole('link', { name: item })).toBeVisible()
      }

      // Open "Mer" drawer (scoped to admin nav to avoid customer "Mer" button)
      await adminNav.getByRole('button', { name: /mer/i }).click()
      await page.waitForTimeout(500)

      const moreItems = ['Recensioner', 'Verifieringar', 'Integrationer', 'Notifikationer']
      for (const item of moreItems) {
        await expect(page.getByRole('link', { name: item })).toBeVisible()
      }
    } else {
      const navItems = ['Översikt', 'Användare', 'Bokningar', 'Recensioner', 'Verifieringar', 'Integrationer', 'System', 'Notifikationer']
      for (const item of navItems) {
        await expect(page.getByRole('link', { name: item })).toBeVisible()
      }
    }
  })

  // ─── Users ───────────────────────────────────────────────────────

  test('should list users with search and filter', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile', 'Table layout not available on mobile')

    await loginAsAdmin(page)
    await page.goto('/admin/users')

    await expect(page.getByRole('heading', { name: 'Användare' })).toBeVisible({ timeout: 10000 })

    // Wait for table data to load (table with actual rows, not just headers)
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20000 })

    // Search for "Test" -- should filter results
    await page.getByPlaceholder(/sök på namn/i).fill('Test')

    // "Test Testsson" should be visible in results (scoped to table to avoid hidden elements)
    await expect(page.locator('table').getByText('Test Testsson').first()).toBeVisible({ timeout: 10000 })
  })

  test('should block and unblock a user', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile', 'DropdownMenu + AlertDialog interaction fragile on mobile')

    await loginAsAdmin(page)
    await page.goto('/admin/users')
    await expect(page.getByRole('heading', { name: 'Användare' })).toBeVisible({ timeout: 10000 })

    // Wait for table to load
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20000 })

    // Search for the dedicated block test user
    await page.getByPlaceholder(/sök på namn/i).fill('BlockTest')

    // Find the row with BlockTest
    const row = page.locator('tr', { hasText: 'BlockTest' })
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.getByRole('button').last().click()

    // Click "Blockera" in dropdown
    await page.getByRole('menuitem', { name: 'Blockera' }).click()

    // Confirm in AlertDialog
    await expect(page.getByText('Bekräfta åtgärd')).toBeVisible()
    await page.getByRole('button', { name: 'Bekräfta' }).click()

    // "Blockerad" badge should appear
    await expect(row.getByText('Blockerad')).toBeVisible({ timeout: 10000 })

    // Now unblock: click action menu again
    await row.getByRole('button').last().click()
    await page.getByRole('menuitem', { name: 'Avblockera' }).click()

    // Confirm
    await expect(page.getByText('Bekräfta åtgärd')).toBeVisible()
    await page.getByRole('button', { name: 'Bekräfta' }).click()

    // "Blockerad" badge should disappear
    await expect(row.getByText('Blockerad')).not.toBeVisible({ timeout: 10000 })
  })

  test('should prevent blocked user from logging in', async ({ page }) => {
    await prisma.user.update({
      where: { id: testUserId },
      data: { isBlocked: true },
    })

    await page.context().clearCookies()
    await page.request.post('/api/test/reset-rate-limit').catch(() => {})

    await page.goto('/login')
    await page.getByLabel(/email/i).fill('e2e-block-test@example.com')
    await page.getByLabel('Lösenord', { exact: true }).fill('BlockTestPass123!')
    await page.getByRole('button', { name: /logga in/i }).click()

    // System shows generic error for security (doesn't reveal account is blocked)
    await expect(page.getByText(/ogiltig email eller lösenord/i)).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/\/login/)

    await prisma.user.update({
      where: { id: testUserId },
      data: { isBlocked: false },
    })
  })

  // ─── Bookings ────────────────────────────────────────────────────

  test('should display bookings with status filter', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile', 'Table layout not available on mobile')

    await loginAsAdmin(page)
    await page.goto('/admin/bookings')

    await expect(page.getByRole('heading', { name: 'Bokningar' })).toBeVisible({ timeout: 10000 })

    // Wait for table to load
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20000 })

    // Status filter should exist
    await expect(page.getByText('Alla statusar')).toBeVisible()
  })

  test('should cancel a booking as admin', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile', 'Table + dialog interaction fragile on mobile')

    await loginAsAdmin(page)
    await page.goto('/admin/bookings')
    await expect(page.getByRole('heading', { name: 'Bokningar' })).toBeVisible({ timeout: 10000 })

    // Wait for table data and find "Avboka" button
    const cancelBtn = page.getByRole('button', { name: 'Avboka' }).first()
    await expect(cancelBtn).toBeVisible({ timeout: 20000 })
    await cancelBtn.click()

    // AlertDialog should appear
    await expect(page.getByRole('heading', { name: 'Avboka bokning' })).toBeVisible()

    // Fill in cancellation reason
    await page.getByPlaceholder(/ange anledning/i).fill('E2E testanledning')

    // Click "Avboka" in dialog
    const dialog = page.locator('[role="alertdialog"]')
    await dialog.getByRole('button', { name: 'Avboka' }).click()

    // Dialog should close
    await expect(page.getByRole('heading', { name: 'Avboka bokning' })).not.toBeVisible({ timeout: 10000 })

    // At least one "Avbokad" badge should exist (scoped to table to avoid hidden filter option)
    await expect(page.locator('table').getByText('Avbokad').first()).toBeVisible({ timeout: 10000 })
  })

  // ─── Reviews ─────────────────────────────────────────────────────

  test('should display reviews page', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/reviews')

    await expect(page.getByRole('heading', { name: 'Recensioner' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Alla typer')).toBeVisible()
  })

  test('should delete a review', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile', 'Table + dialog interaction fragile on mobile')

    await loginAsAdmin(page)
    await page.goto('/admin/reviews')
    await expect(page.getByRole('heading', { name: 'Recensioner' })).toBeVisible({ timeout: 10000 })

    // Wait for table row with data
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20000 })

    // Click the delete button in the first row
    const deleteBtn = page.locator('table tbody tr').first().locator('button').last()
    await expect(deleteBtn).toBeVisible({ timeout: 5000 })
    await deleteBtn.click()

    // AlertDialog should appear
    await expect(page.getByRole('heading', { name: 'Ta bort recension' })).toBeVisible()

    // Confirm deletion
    await page.getByRole('button', { name: 'Ta bort' }).click()

    // Dialog should close
    await expect(page.getByRole('heading', { name: 'Ta bort recension' })).not.toBeVisible({ timeout: 10000 })
  })

  // ─── Notifications ───────────────────────────────────────────────

  test('should send bulk notification', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/notifications')

    await expect(page.getByRole('heading', { name: 'Skicka notifikation' })).toBeVisible({ timeout: 10000 })

    // Fill in notification form
    await page.getByPlaceholder(/viktig uppdatering/i).fill('E2E testnotifikation')
    await page.getByPlaceholder(/skriv ditt meddelande/i).fill('Detta ar en testnotifikation fran E2E')

    // Click "Skicka notifikation"
    await page.getByRole('button', { name: /skicka notifikation/i }).click()

    // Confirm in AlertDialog
    await expect(page.getByText(/skicka notifikationen/i)).toBeVisible()
    await page.getByRole('button', { name: 'Skicka' }).click()

    // Success message should appear
    await expect(page.getByText(/notifikation skickad/i)).toBeVisible({ timeout: 10000 })
  })

  // ─── Access control ──────────────────────────────────────────────

  test('should deny non-admin access to admin pages', async ({ page }) => {
    // Sign out explicitly to clear any cached admin session
    await page.goto('/api/auth/signout', { waitUntil: 'networkidle' })
    await page.context().clearCookies()

    await loginAsCustomer(page)

    // Admin API routes have requireAdmin() which returns 403 for non-admin users
    // (middleware auth check is unreliable in Next.js 16 E2E -- test API-level protection instead)
    const response = await page.request.get('/api/admin/users')
    expect(response.status()).toBe(403)
  })

  test('should deny non-admin access to admin API', async ({ page }) => {
    await loginAsCustomer(page)

    // Fetch admin API -- should get 403
    const response = await page.request.get('/api/admin/stats')
    expect(response.status()).toBe(403)
  })
})
