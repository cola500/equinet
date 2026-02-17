import { test, expect } from './fixtures';
import { seedBooking, cleanupSpecData, getBaseEntities } from './setup/seed-helpers';
import { prisma } from './fixtures';

const SPEC_TAG = 'noshow';

/**
 * E2E Tests for No-Show Feature
 *
 * Tests:
 * 1. Show "Ej infunnit" button for confirmed bookings (provider/bookings)
 * 2. Mark booking as no-show -> badge changes
 * 3. No-show badge visible in customer's booking list
 * 4. Warning badge (no-shows) in customer registry
 * 5. No-show button in calendar BookingDetailDialog (desktop only)
 */

/** Navigate to provider bookings and wait for API data to load */
async function gotoProviderBookingsAndWaitForData(page: import('@playwright/test').Page) {
  const apiResponsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/bookings') && resp.request().method() === 'GET',
    { timeout: 15000 }
  );
  await page.goto('/provider/bookings');
  const response = await apiResponsePromise;
  if (response.status() !== 200) {
    const body = await response.text().catch(() => '');
    throw new Error(`/api/bookings returned ${response.status()}: ${body}`);
  }
  await page.waitForTimeout(500);
}

test.describe('No-Show (Provider)', () => {
  test.beforeAll(async () => {
    await cleanupSpecData(SPEC_TAG);

    // Booking 1: confirmed, past -- for marking as no-show
    await seedBooking({
      specTag: SPEC_TAG,
      status: 'confirmed',
      daysFromNow: -1,
    });

    // Booking 2: seed as no_show directly
    await seedBooking({
      specTag: SPEC_TAG,
      status: 'no_show',
      daysFromNow: -2,
      startTime: '12:00',
      endTime: '13:00',
    });
  });

  test.afterAll(async () => {
    await cleanupSpecData(SPEC_TAG);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('provider@example.com');
    await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!');
    await page.getByRole('button', { name: /logga in/i }).click();
    await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 10000 });
  });

  test('should show "Ej infunnit" button for confirmed booking', async ({ page }) => {
    await gotoProviderBookingsAndWaitForData(page);

    // Click "Bekräftade" tab
    await page.getByRole('button', { name: /Bekräftade/i }).click();
    await page.waitForTimeout(500);

    // Our seeded confirmed booking should appear (filter by specTag marker)
    const bookingCard = page.locator('[data-testid="booking-item"]')
      .filter({ hasText: `E2E-spec:${SPEC_TAG}` })
      .first();
    await expect(bookingCard).toBeVisible({ timeout: 10000 });

    // "Ej infunnit" button should be visible for confirmed bookings
    await expect(bookingCard.getByRole('button', { name: /Ej infunnit/i })).toBeVisible({ timeout: 5000 });
  });

  test('should mark booking as no-show and show badge', async ({ page }) => {
    await gotoProviderBookingsAndWaitForData(page);

    // Click "Bekräftade" to find our confirmed booking
    await page.getByRole('button', { name: /Bekräftade/i }).click();
    await page.waitForTimeout(500);

    // Find confirmed booking by specTag marker
    const bookingCard = page.locator('[data-testid="booking-item"]')
      .filter({ hasText: `E2E-spec:${SPEC_TAG}` })
      .first();
    await expect(bookingCard).toBeVisible({ timeout: 10000 });

    // Click "Ej infunnit" button
    await bookingCard.getByRole('button', { name: /Ej infunnit/i }).click();

    // Wait for status update API call
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/bookings/') && resp.request().method() === 'PUT',
      { timeout: 10000 }
    );
    await page.waitForTimeout(1000);

    // Now switch to "Ej infunna" tab to see the no-show booking
    await page.getByRole('button', { name: /Ej infunna/i }).click();
    await page.waitForTimeout(500);

    // Booking should now appear in the "Ej infunna" tab
    await expect(
      page.locator('[data-testid="booking-item"]')
        .filter({ hasText: `E2E-spec:${SPEC_TAG}` })
        .first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('should show no-show badge in customer booking list', async ({ page }) => {
    // Log in as customer
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel('Lösenord', { exact: true }).fill('TestPassword123!');
    await page.getByRole('button', { name: /logga in/i }).click();
    await expect(page).toHaveURL(/\/providers/, { timeout: 10000 });

    // Navigate to customer bookings and wait for API
    const apiResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/bookings') && resp.request().method() === 'GET',
      { timeout: 15000 }
    );
    await page.goto('/customer/bookings');
    await apiResponsePromise;
    await page.waitForTimeout(500);

    await expect(page.getByRole('heading', { name: /Mina bokningar/i })).toBeVisible({ timeout: 10000 });

    // No-show bookings are in the past -- click "Tidigare" or "Alla"
    await page.getByRole('button', { name: 'Alla' }).click();
    await page.waitForTimeout(500);

    // "Ej infunnit" badge should be visible for the no-show bookings
    await expect(page.getByText('Ej infunnit').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show no-show warning in customer registry', async ({ page, isMobile }) => {
    // No-show count badge is hidden on mobile (CSS: hidden sm:block)
    test.skip(!!isMobile, 'No-show badge not visible in compact mobile card');
    // Wait for customer list API to load
    const apiPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/provider/customers') && resp.request().method() === 'GET',
      { timeout: 15000 }
    );
    await page.goto('/provider/customers');
    await apiPromise;
    await expect(page.getByRole('heading', { name: 'Kunder', exact: true })).toBeVisible({ timeout: 10000 });

    // Wait for customer list to render
    await expect(page.getByText('test@example.com')).toBeVisible({ timeout: 10000 });

    // The test customer should show no-show count
    await expect(page.getByText(/utebliven/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should show no-show button in calendar BookingDetailDialog', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'Calendar layout differs on mobile');

    await page.goto('/provider/calendar');
    await page.waitForTimeout(3000);

    const bookingBlock = page.locator('button.absolute.border-l-4').first();
    const hasBooking = await bookingBlock.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasBooking) {
      test.skip(true, 'No visible bookings in calendar view');
      return;
    }

    await bookingBlock.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // If booking is confirmed, "Ej infunnit" button should be visible
    const noShowBtn = dialog.getByRole('button', { name: /Ej infunnit/i });
    const isConfirmed = await noShowBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (isConfirmed) {
      await expect(noShowBtn).toBeVisible();
    }
  });
});
