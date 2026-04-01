/**
 * E2E test for Stripe Payment Element flow.
 *
 * This test requires real Stripe test keys (sk_test_... / pk_test_...).
 * It is automatically skipped when keys are missing.
 *
 * The test creates a confirmed booking, initiates payment via POST
 * (which creates a PaymentIntent with PAYMENT_PROVIDER=stripe),
 * fills in the Stripe Payment Element iframe with a test card,
 * and verifies the payment succeeds.
 *
 * NOTE: This spec overrides PAYMENT_PROVIDER to 'stripe' via
 * the test setup. The default in playwright.config.ts is 'mock'
 * to protect other payment specs from Stripe-specific behavior.
 */

import { test, expect, prisma } from './fixtures'

// Skip entire suite if Stripe keys are not configured
const hasStripeKeys = !!(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)

test.describe('Stripe Payment Element', () => {
  test.skip(!hasStripeKeys, 'Stripe test keys not configured -- skipping Stripe E2E')

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

    // Create confirmed booking
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

    // Login as customer
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

  test('should complete payment with Stripe test card', async ({ page }) => {
    if (!testBookingId) {
      test.skip(true, 'No test booking created')
      return
    }

    // Navigate to bookings
    await page.goto('/customer/bookings')
    await page.waitForSelector('[data-testid="booking-item"]', { timeout: 10000 })

    // Find our test booking
    const bookingCard = page.locator('[data-testid="booking-item"]').filter({
      hasText: 'StripePaymentTestHorse',
    })
    await expect(bookingCard).toBeVisible({ timeout: 5000 })

    // Click pay button -- this POSTs to create PaymentIntent
    const payButton = bookingCard.getByRole('button', { name: /betala.*kr/i })
    await expect(payButton).toBeVisible({ timeout: 5000 })
    await payButton.click()

    // Wait for PaymentDialog to appear with Stripe Element
    await expect(page.getByText(/fyll i dina kortuppgifter/i)).toBeVisible({ timeout: 15000 })

    // Stripe Payment Element renders in an iframe
    // Wait for the iframe to load
    const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').first()

    // Fill in test card number: 4242 4242 4242 4242
    const cardNumber = stripeFrame.getByPlaceholder(/card number|kortnummer/i)
    await cardNumber.waitFor({ state: 'visible', timeout: 15000 })
    await cardNumber.fill('4242424242424242')

    // Fill expiry date
    const expiry = stripeFrame.getByPlaceholder(/mm.*yy|mm.*åå/i)
    await expiry.fill('1230')

    // Fill CVC
    const cvc = stripeFrame.getByPlaceholder(/cvc|cvv/i)
    await cvc.fill('123')

    // Click the pay button in the dialog
    const dialogPayButton = page.getByRole('button', { name: /betala.*kr/i }).last()
    await dialogPayButton.click()

    // Wait for success -- either toast or badge change
    // Stripe confirmation can take a few seconds
    await expect(page.getByText(/betalning genomförd/i)).toBeVisible({ timeout: 30000 })

    // Verify booking now shows as paid
    await expect(bookingCard.getByText(/betald/i)).toBeVisible({ timeout: 10000 })
  })
})
