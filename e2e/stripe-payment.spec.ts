/**
 * E2E test for Stripe Payment Element rendering.
 *
 * Verifies that:
 * 1. PaymentIntent is created server-side (clientSecret returned)
 * 2. PaymentDialog opens with Stripe PaymentElement
 * 3. Stripe iframe loads with card input fields
 *
 * NOTE: Stripe officially recommends NOT automating card input in PaymentElement
 * (https://docs.stripe.com/automated-testing). Card fill + submit is tested by:
 * - Unit: StripePaymentGateway.test.ts (SDK interaction)
 * - Integration: route.integration.test.ts (route -> service -> gateway)
 * - E2E mock: payment.spec.ts (UI flow with instant success via MockPaymentGateway)
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

    // Capture payment API response to verify PaymentIntent creation
    const paymentResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/payment') && resp.request().method() === 'POST',
      { timeout: 15000 }
    )

    // Click pay -- creates PaymentIntent server-side
    const payButton = bookingCard.getByRole('button', { name: /betala.*kr/i })
    await payButton.click()

    // Verify server created PaymentIntent with clientSecret
    const paymentResponse = await paymentResponsePromise
    expect(paymentResponse.status()).toBe(200)
    const paymentData = await paymentResponse.json()
    expect(paymentData.clientSecret).toBeTruthy()
    expect(paymentData.payment.status).toBe('pending')

    // PaymentDialog should open
    await expect(page.getByText(/fyll i dina kortuppgifter/i)).toBeVisible({ timeout: 15000 })

    // Stripe PaymentElement should render card input inside an iframe.
    // Find the frame containing input[name="number"] (card number field).
    let stripeFrame = null as Awaited<ReturnType<typeof page.frames>[number]> | null
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
      for (const frame of page.frames()) {
        const hasCardInput = await frame.$('input[name="number"]').catch(() => null)
        if (hasCardInput) {
          stripeFrame = frame
          break
        }
      }
      if (stripeFrame) break
      await page.waitForTimeout(500)
    }

    // Verify Stripe iframe loaded with card fields
    expect(stripeFrame).not.toBeNull()
    const cardInput = await stripeFrame!.$('input[name="number"]')
    expect(cardInput).not.toBeNull()
    const expiryInput = await stripeFrame!.$('input[name="expiry"]')
    expect(expiryInput).not.toBeNull()
    const cvcInput = await stripeFrame!.$('input[name="cvc"]')
    expect(cvcInput).not.toBeNull()

    // Card input + submit is intentionally NOT automated here.
    // Stripe recommends against it (security measures cause flaky tests).
    // See file header for the full test coverage strategy.
  })
})
