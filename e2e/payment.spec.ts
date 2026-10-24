import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { seedBooking, cleanupSpecData } from './setup/seed-helpers'
import { prisma } from './fixtures'

/**
 * Vertical slice C3 + C2 (BR-BOOK-001, BR-PAY-001)
 *
 * 1. A confirmed booking whose end time has passed: the provider marks it
 *    completed, then the customer pays (mock gateway) and sees "Betald".
 *    (SC-BOOK-001, SC-PAY-001)
 * 2. A confirmed booking in the future: the provider's button is disabled
 *    with an explanation, the customer sees no pay button, and the server
 *    rejects both actions even when called directly.
 *    (SC-BOOK-002/003, SC-PAY-003)
 *
 * Requires FEATURE_STRIPE_PAYMENTS=true (set in playwright.config.ts) and the
 * mock payment gateway (PAYMENT_PROVIDER unset).
 */

const SPEC_TAG = 'c3c2-payment'
const RUN = Date.now()
const PAST_HORSE = `E2E Utförd ${RUN}`
const FUTURE_HORSE = `E2E Kommande ${RUN}`

let pastBooking: { id: string }
let futureBooking: { id: string }

async function gotoWithBookings(page: Page, path: string) {
  const bookingsLoaded = page.waitForResponse(
    (resp) => resp.url().includes('/api/bookings') && resp.request().method() === 'GET',
    { timeout: 15000 }
  )
  await page.goto(path)
  await bookingsLoaded
}

// The shared helpers in setup/visual-helpers.ts still expect the old landing
// pages. Providers land on /provider/calendar via /dashboard.
async function loginAsProvider(page: Page) {
  await page.context().clearCookies()
  await page.request.post('/api/test/reset-rate-limit').catch(() => {})
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('provider@example.com')
  await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!')
  await page.getByRole('button', { name: /logga in/i }).click()
  await expect(page).toHaveURL(/\/provider\/(calendar|dashboard)/, { timeout: 15000 })
}

// Customers land on /hem via /dashboard.
async function loginAsCustomer(page: Page) {
  await page.context().clearCookies()
  await page.request.post('/api/test/reset-rate-limit').catch(() => {})
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('test@example.com')
  await page.getByLabel('Lösenord', { exact: true }).fill('TestPassword123!')
  await page.getByRole('button', { name: /logga in/i }).click()
  await expect(page).toHaveURL(/\/(hem|dashboard|providers)/, { timeout: 15000 })
}

function providerCard(page: Page, horseName: string) {
  return page.locator('[data-testid="booking-item"]').filter({ hasText: horseName })
}

test.describe('Utförd bokning och betalning (C3 + C2)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await cleanupSpecData(SPEC_TAG)

    pastBooking = await seedBooking({
      specTag: SPEC_TAG,
      status: 'confirmed',
      daysFromNow: -1,
      horseName: PAST_HORSE,
      startTime: '09:00',
      endTime: '10:00',
    })

    futureBooking = await seedBooking({
      specTag: SPEC_TAG,
      status: 'confirmed',
      daysFromNow: 3,
      horseName: FUTURE_HORSE,
      startTime: '13:00',
      endTime: '14:00',
    })
  })

  test.afterAll(async () => {
    await cleanupSpecData(SPEC_TAG)
  })

  test.beforeEach(async ({ page }) => {
    await page.request.post('/api/test/reset-rate-limit').catch(() => {})
  })

  test('SC-BOOK-001 + SC-PAY-001 – leverantören markerar genomförd efter sluttid och kunden betalar', async ({ page }) => {
    // Provider marks the past booking completed
    await loginAsProvider(page)
    await gotoWithBookings(page, '/provider/bookings')
    await page.getByRole('button', { name: /Bekräftade/i }).click({ timeout: 10000 })

    const card = providerCard(page, PAST_HORSE)
    await expect(card).toBeVisible({ timeout: 10000 })
    const completeButton = card.getByRole('button', { name: 'Markera som genomförd' })
    await expect(completeButton).toBeEnabled()
    await completeButton.click()
    await expect(page.getByText('Bokning uppdaterad!').first()).toBeVisible({ timeout: 10000 })

    await expect
      .poll(async () => (await prisma.booking.findUnique({ where: { id: pastBooking.id } }))?.status)
      .toBe('completed')

    // Customer pays the completed booking
    await loginAsCustomer(page)
    await gotoWithBookings(page, '/customer/bookings')
    await page.getByRole('button', { name: 'Alla' }).click()

    const customerCard = page.locator('[data-testid="booking-item"]').filter({ hasText: PAST_HORSE })
    await expect(customerCard).toBeVisible({ timeout: 10000 })
    await customerCard.getByRole('button', { name: /^Betala \d+ kr$/ }).click()

    await expect(page.getByText('Betalning genomförd!').first()).toBeVisible({ timeout: 10000 })
    await expect(customerCard.getByText('Betald')).toBeVisible({ timeout: 10000 })
  })

  test('SC-BOOK-003 + SC-PAY-003 – framtida bekräftad bokning kan varken markeras eller betalas', async ({ page }) => {
    // Provider: button disabled with explanation
    await loginAsProvider(page)
    await gotoWithBookings(page, '/provider/bookings')
    await page.getByRole('button', { name: /Bekräftade/i }).click({ timeout: 10000 })

    const card = providerCard(page, FUTURE_HORSE)
    await expect(card).toBeVisible({ timeout: 10000 })
    await expect(card.getByRole('button', { name: 'Markera som genomförd' })).toBeDisabled()
    await expect(card.getByText('Kan markeras som genomförd efter kl. 14:00')).toBeVisible()

    // Server is authoritative even if the UI guard is bypassed (SC-BOOK-002)
    const completeRes = await page.request.put(`/api/bookings/${futureBooking.id}`, {
      data: { status: 'completed' },
    })
    expect(completeRes.status()).toBe(400)
    expect((await completeRes.json()).error).toBe(
      'Bokningen kan markeras som genomförd först efter bokad sluttid (kl. 14:00).'
    )

    // Customer: no pay button, explanation instead
    await loginAsCustomer(page)
    await gotoWithBookings(page, '/customer/bookings')
    await page.getByRole('button', { name: 'Alla' }).click()

    const customerCard = page.locator('[data-testid="booking-item"]').filter({ hasText: FUTURE_HORSE })
    await expect(customerCard).toBeVisible({ timeout: 10000 })
    await expect(customerCard.getByRole('button', { name: /Betala/ })).toHaveCount(0)
    await expect(customerCard.getByText('Betalning öppnas när besöket är genomfört')).toBeVisible()

    const payRes = await page.request.post(`/api/bookings/${futureBooking.id}/payment`)
    expect(payRes.status()).toBe(400)
    expect((await payRes.json()).error).toBe('Bokningen kan betalas först när tjänsten är utförd.')

    const stored = await prisma.booking.findUnique({
      where: { id: futureBooking.id },
      select: { status: true, payment: { select: { id: true } } },
    })
    expect(stored?.status).toBe('confirmed')
    expect(stored?.payment).toBeNull()
  })
})
