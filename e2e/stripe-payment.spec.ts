/**
 * E2E test for Stripe Payment Element flow.
 *
 * This test requires:
 * - Stripe test keys in .env.local (sk_test_... / pk_test_...)
 * - PAYMENT_PROVIDER=stripe (pass as env when running)
 * - Dev server with Stripe.js loaded
 *
 * Run: PAYMENT_PROVIDER=stripe npx playwright test e2e/stripe-payment.spec.ts --headed
 *
 * NOTE: Stripe Payment Element renders in iframes loaded from js.stripe.com.
 * This can be unreliable in headless mode. Run --headed for debugging.
 *
 * The full payment chain is verified by:
 * - Unit tests: StripePaymentGateway.test.ts (SDK interaction)
 * - Integration tests: route.integration.test.ts (route -> service -> gateway)
 * - E2E mock tests: payment.spec.ts (UI flow with instant success)
 * This spec adds browser-level verification of the Stripe Payment Element.
 */

import { test, expect, prisma } from './fixtures'

const hasStripeKeys = !!(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
const isStripeProvider = process.env.PAYMENT_PROVIDER === 'stripe'

test.describe('Stripe Payment Element', () => {
  test.skip(!hasStripeKeys || !isStripeProvider, 'Requires STRIPE keys + PAYMENT_PROVIDER=stripe')

  let testBookingId: string | null = null

  test.beforeEach(async ({ page }) => {
    await page.request.post('/api/test/reset-rate-limit').catch(() => {})

    const customer = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
    })

    if (!customer) {
      test.skip(true, 'Test customer not found')
      return
    }

    const provider = await prisma.provider.findFirst({
      where: { services: { some: {} } },
      include: { services: true },
    })

    if (!provider?.services[0]) {
      test.skip(true, 'No provider with services found')
      return
    }

    // Clean up previous test data
    await prisma.payment.deleteMany({
      where: { booking: { horseName: 'StripePaymentTestHorse' } },
    })
    await prisma.booking.deleteMany({
      where: { horseName: 'StripePaymentTestHorse' },
    })

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const booking = await prisma.booking.create({
      data: {
        customer: { connect: { id: customer.id } },
        provider: { connect: { id: provider.id } },
        service: { connect: { id: provider.services[0].id } },
        bookingDate: futureDate,
        startTime: '10:00',
        endTime: '11:00',
        status: 'confirmed',
        horseName: 'StripePaymentTestHorse',
        customerNotes: 'E2E Stripe payment test',
      },
    })
    testBookingId = booking.id

    await page.goto('/login')
    await page.getByLabel(/email/i).fill('test@example.com')
    await page.getByLabel('Lösenord', { exact: true }).fill('TestPassword123!')
    await page.getByRole('button', { name: /logga in/i }).click()
    await expect(page).toHaveURL(/\/providers/, { timeout: 10000 })
  })

  test.afterEach(async () => {
    if (testBookingId) {
      await prisma.payment.deleteMany({ where: { bookingId: testBookingId } })
      await prisma.booking.delete({ where: { id: testBookingId } }).catch(() => {})
      testBookingId = null
    }
  })

  test('should open payment dialog with Stripe form', async ({ page }) => {
    if (!testBookingId) {
      test.skip(true, 'No test booking created')
      return
    }

    await page.goto('/customer/bookings')
    await page.waitForSelector('[data-testid="booking-item"]', { timeout: 10000 })

    const bookingCard = page.locator('[data-testid="booking-item"]').filter({
      hasText: 'StripePaymentTestHorse',
    })
    await expect(bookingCard).toBeVisible({ timeout: 5000 })

    // Click pay -- creates PaymentIntent server-side
    const payButton = bookingCard.getByRole('button', { name: /betala.*kr/i })
    await payButton.click()

    // PaymentDialog should open
    await expect(page.getByText(/fyll i dina kortuppgifter/i)).toBeVisible({ timeout: 15000 })

    // Stripe Payment Element should load (iframe from js.stripe.com)
    const stripeIframe = page.locator('iframe[src*="stripe.com"], iframe[title*="Secure"], iframe[name*="__privateStripeFrame"]').first()
    await stripeIframe.waitFor({ state: 'attached', timeout: 30000 })

    // Access iframe and fill test card
    const stripeFrame = stripeIframe.contentFrame()
    const cardInput = stripeFrame.locator('[name="number"], [autocomplete="cc-number"]').first()
    await cardInput.waitFor({ state: 'visible', timeout: 15000 })
    await cardInput.fill('4242424242424242')

    const expiryInput = stripeFrame.locator('[name="expiry"], [autocomplete="cc-exp"]').first()
    await expiryInput.fill('1230')

    const cvcInput = stripeFrame.locator('[name="cvc"], [autocomplete="cc-csc"]').first()
    await cvcInput.fill('123')

    // Submit payment
    const dialogPayButton = page.getByRole('button', { name: /betala.*kr/i }).last()
    await expect(dialogPayButton).toBeEnabled({ timeout: 5000 })
    await dialogPayButton.click()

    // Wait for success
    await expect(page.getByText(/betalning genomförd/i)).toBeVisible({ timeout: 30000 })
    await expect(bookingCard.getByText(/betald/i)).toBeVisible({ timeout: 10000 })
  })
})
