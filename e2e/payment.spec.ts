import { test, expect } from './fixtures'
import { PrismaClient } from '@prisma/client'

test.describe('Payment Flow', () => {
  // Create a confirmed booking that can be paid
  let testBookingId: string | null = null

  test.beforeEach(async ({ page }) => {
    const prisma = new PrismaClient()

    try {
      // Find the test customer
      const customer = await prisma.user.findUnique({
        where: { email: 'test@example.com' }
      })

      if (!customer) {
        console.log('Test customer not found, skipping payment tests')
        return
      }

      // Find a provider with services
      const provider = await prisma.provider.findFirst({
        where: {
          services: { some: {} }
        },
        include: {
          services: true
        }
      })

      if (!provider || !provider.services[0]) {
        console.log('No provider with services found, skipping payment tests')
        return
      }

      // Create a confirmed booking for payment testing
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30) // 30 days in future
      const dateString = futureDate.toISOString().split('T')[0]

      // Clean up any existing test payment bookings first
      await prisma.payment.deleteMany({
        where: {
          booking: {
            horseName: 'PaymentTestHorse'
          }
        }
      })

      await prisma.booking.deleteMany({
        where: {
          horseName: 'PaymentTestHorse'
        }
      })

      // Create a new confirmed booking
      const booking = await prisma.booking.create({
        data: {
          customer: { connect: { id: customer.id } },
          provider: { connect: { id: provider.id } },
          service: { connect: { id: provider.services[0].id } },
          bookingDate: new Date(dateString),
          startTime: '14:00',
          endTime: '15:00',
          status: 'confirmed', // Already confirmed so it can be paid
          horseName: 'PaymentTestHorse',
          customerNotes: 'E2E payment test booking'
        }
      })

      testBookingId = booking.id
    } finally {
      await prisma.$disconnect()
    }

    // Login as customer
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('test@example.com')
    await page.getByLabel(/lösenord/i).fill('TestPassword123!')
    await page.getByRole('button', { name: /logga in/i }).click()
    await expect(page).toHaveURL(/\/providers/, { timeout: 10000 })
  })

  test.afterEach(async () => {
    // Clean up the test booking
    if (testBookingId) {
      const prisma = new PrismaClient()
      try {
        await prisma.payment.deleteMany({
          where: { bookingId: testBookingId }
        })
        await prisma.booking.delete({
          where: { id: testBookingId }
        }).catch(() => {}) // Ignore if already deleted
      } finally {
        await prisma.$disconnect()
      }
      testBookingId = null
    }
  })

  test('should pay for a confirmed booking', async ({ page }) => {
    if (!testBookingId) {
      console.log('No test booking created, skipping test')
      return
    }

    // Go to customer bookings
    await page.goto('/customer/bookings')

    // Wait for bookings to load
    await page.waitForSelector('[data-testid="booking-item"]', { timeout: 10000 })

    // Find the payment test booking
    const bookingCard = page.locator('[data-testid="booking-item"]').filter({
      hasText: 'PaymentTestHorse'
    })

    await expect(bookingCard).toBeVisible({ timeout: 5000 })

    // Find and click the pay button
    const payButton = bookingCard.getByRole('button', { name: /betala.*kr/i })
    await expect(payButton).toBeVisible({ timeout: 5000 })

    // Click pay
    await payButton.click()

    // Wait for payment to process (toast appears)
    await expect(page.getByText(/betalning genomförd/i)).toBeVisible({ timeout: 10000 })

    // Verify the booking now shows as paid
    await expect(bookingCard.getByText(/betald/i)).toBeVisible({ timeout: 5000 })
  })

  test('should show receipt link after payment', async ({ page }) => {
    if (!testBookingId) {
      console.log('No test booking created, skipping test')
      return
    }

    // Go to customer bookings
    await page.goto('/customer/bookings')

    // Wait for bookings to load
    await page.waitForSelector('[data-testid="booking-item"]', { timeout: 10000 })

    // Find the payment test booking
    const bookingCard = page.locator('[data-testid="booking-item"]').filter({
      hasText: 'PaymentTestHorse'
    })

    await expect(bookingCard).toBeVisible({ timeout: 5000 })

    // Pay for the booking
    const payButton = bookingCard.getByRole('button', { name: /betala.*kr/i })
    await payButton.click()

    // Wait for payment to complete
    await expect(page.getByText(/betalning genomförd/i)).toBeVisible({ timeout: 10000 })

    // Verify receipt link appears
    const receiptLink = bookingCard.getByRole('link', { name: /ladda ner kvitto/i })
    await expect(receiptLink).toBeVisible({ timeout: 5000 })

    // Verify the link has correct href pattern
    const href = await receiptLink.getAttribute('href')
    expect(href).toContain('/api/bookings/')
    expect(href).toContain('/receipt')
  })

  test('should show invoice number after payment', async ({ page }) => {
    if (!testBookingId) {
      console.log('No test booking created, skipping test')
      return
    }

    // Go to customer bookings
    await page.goto('/customer/bookings')

    // Wait for bookings to load
    await page.waitForSelector('[data-testid="booking-item"]', { timeout: 10000 })

    // Find the payment test booking
    const bookingCard = page.locator('[data-testid="booking-item"]').filter({
      hasText: 'PaymentTestHorse'
    })

    // Pay for the booking
    const payButton = bookingCard.getByRole('button', { name: /betala.*kr/i })
    await payButton.click()

    // Wait for payment to complete
    await expect(page.getByText(/betalning genomförd/i)).toBeVisible({ timeout: 10000 })

    // Verify invoice number is shown (format: EQ-YYYYMM-XXXXXX)
    await expect(bookingCard.getByText(/kvitto:.*eq-/i)).toBeVisible({ timeout: 5000 })
  })

  test('should hide cancel button for paid bookings', async ({ page }) => {
    if (!testBookingId) {
      console.log('No test booking created, skipping test')
      return
    }

    // Go to customer bookings
    await page.goto('/customer/bookings')

    // Wait for bookings to load
    await page.waitForSelector('[data-testid="booking-item"]', { timeout: 10000 })

    // Find the payment test booking
    const bookingCard = page.locator('[data-testid="booking-item"]').filter({
      hasText: 'PaymentTestHorse'
    })

    // Before payment: cancel button should be visible
    const cancelButton = bookingCard.getByRole('button', { name: /avboka/i })
    await expect(cancelButton).toBeVisible({ timeout: 5000 })

    // Pay for the booking
    const payButton = bookingCard.getByRole('button', { name: /betala.*kr/i })
    await payButton.click()

    // Wait for payment to complete
    await expect(page.getByText(/betalning genomförd/i)).toBeVisible({ timeout: 10000 })

    // After payment: cancel button should NOT be visible
    await expect(cancelButton).not.toBeVisible({ timeout: 5000 })
  })

  test('should not allow double payment', async ({ page }) => {
    if (!testBookingId) {
      console.log('No test booking created, skipping test')
      return
    }

    // Go to customer bookings
    await page.goto('/customer/bookings')

    // Wait for bookings to load
    await page.waitForSelector('[data-testid="booking-item"]', { timeout: 10000 })

    // Find the payment test booking
    const bookingCard = page.locator('[data-testid="booking-item"]').filter({
      hasText: 'PaymentTestHorse'
    })

    // Pay for the booking
    const payButton = bookingCard.getByRole('button', { name: /betala.*kr/i })
    await payButton.click()

    // Wait for payment to complete
    await expect(page.getByText(/betalning genomförd/i)).toBeVisible({ timeout: 10000 })

    // Pay button should no longer exist
    await expect(payButton).not.toBeVisible({ timeout: 5000 })

    // Instead, "Betald" badge should be visible
    await expect(bookingCard.getByText(/betald/i)).toBeVisible()
  })
})

test.describe('Payment - Pending Booking', () => {
  test('should not show pay button for pending bookings', async ({ page }) => {
    const prisma = new PrismaClient()
    let pendingBookingId: string | null = null

    try {
      // Find the test customer
      const customer = await prisma.user.findUnique({
        where: { email: 'test@example.com' }
      })

      if (!customer) {
        console.log('Test customer not found, skipping test')
        return
      }

      // Find a provider with services
      const provider = await prisma.provider.findFirst({
        where: { services: { some: {} } },
        include: { services: true }
      })

      if (!provider?.services[0]) {
        console.log('No provider with services found, skipping test')
        return
      }

      // Create a PENDING booking (not confirmed)
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 31)

      const booking = await prisma.booking.create({
        data: {
          customer: { connect: { id: customer.id } },
          provider: { connect: { id: provider.id } },
          service: { connect: { id: provider.services[0].id } },
          bookingDate: futureDate,
          startTime: '16:00',
          endTime: '17:00',
          status: 'pending', // Not confirmed yet
          horseName: 'PendingPaymentTest',
          customerNotes: 'E2E test - pending booking'
        }
      })

      pendingBookingId = booking.id

      // Login as customer
      await page.goto('/login')
      await page.getByLabel(/email/i).fill('test@example.com')
      await page.getByLabel(/lösenord/i).fill('TestPassword123!')
      await page.getByRole('button', { name: /logga in/i }).click()
      await expect(page).toHaveURL(/\/providers/, { timeout: 10000 })

      // Go to customer bookings
      await page.goto('/customer/bookings')

      // Wait for bookings to load
      await page.waitForSelector('[data-testid="booking-item"]', { timeout: 10000 })

      // Find the pending booking
      const bookingCard = page.locator('[data-testid="booking-item"]').filter({
        hasText: 'PendingPaymentTest'
      })

      await expect(bookingCard).toBeVisible({ timeout: 5000 })

      // Verify status shows "Väntar på svar"
      await expect(bookingCard.getByText(/väntar på svar/i)).toBeVisible()

      // Pay button should NOT be visible for pending bookings
      const payButton = bookingCard.getByRole('button', { name: /betala.*kr/i })
      await expect(payButton).not.toBeVisible()

    } finally {
      // Cleanup
      if (pendingBookingId) {
        await prisma.booking.delete({
          where: { id: pendingBookingId }
        }).catch(() => {})
      }
      await prisma.$disconnect()
    }
  })
})
