import { test, expect } from './fixtures';
import { seedBooking, cleanupSpecData, getBaseEntities } from './setup/seed-helpers';

const SPEC_TAG = 'reviews';

/**
 * E2E Tests for Customer Reviews (Kundrecensioner)
 *
 * Tests:
 * - Show "Recensera kund" button for completed bookings
 * - Submit review with rating and comment
 * - Require rating before submitting
 * - Show existing review after submission
 *
 * IMPORTANT: CustomerReview is immutable (one per booking). Tests 2-4 depend on test 1.
 */

test.describe('Customer Reviews (Provider)', () => {
  test.beforeAll(async () => {
    await cleanupSpecData(SPEC_TAG);
    const base = await getBaseEntities();

    // Booking 1: for "submit review" test (test 2)
    await seedBooking({
      specTag: SPEC_TAG,
      status: 'completed',
      daysFromNow: -90,
      horseName: 'E2E ReviewSubmit',
      horseId: base.horseId,
    });

    // Booking 2: for "require rating" test (test 3) - different time to stay unique
    await seedBooking({
      specTag: SPEC_TAG,
      status: 'completed',
      daysFromNow: -85,
      horseName: 'E2E ReviewValidation',
      horseId: base.horseId,
      startTime: '12:00',
      endTime: '13:00',
    });
  });

  test.afterAll(async () => {
    await cleanupSpecData(SPEC_TAG);
  });

  test.beforeEach(async ({ page }) => {
    // Reset rate limits to avoid 429 after many preceding tests
    await page.request.post('/api/test/reset-rate-limit').catch(() => {});

    // Logga in som provider
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('provider@example.com');
    await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!');
    await page.getByRole('button', { name: /logga in/i }).click();
    await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 10000 });
  });

  /**
   * Helper: Navigate to completed booking on /provider/bookings
   */
  async function navigateToCompletedBookings(page: import('@playwright/test').Page) {
    await page.goto('/provider/bookings');
    await expect(page.getByRole('heading', { name: 'Bokningar', exact: true })).toBeVisible({ timeout: 10000 });

    // Click "Alla" filter to see completed bookings
    await page.getByRole('button', { name: /alla/i }).click();
    await page.waitForTimeout(1000);

    // Verify completed booking is visible (Hovslagning Standard, status "Genomförd")
    await expect(page.getByText('Genomförd').first()).toBeVisible({ timeout: 10000 });
  }

  test('should show review button for completed booking', async ({ page }) => {
    await navigateToCompletedBookings(page);

    // Find the first completed booking card
    const completedCard = page.locator('[data-testid="booking-item"]').filter({ hasText: /Genomförd/ }).first();
    await expect(completedCard).toBeVisible();

    // "Recensera kund" button should be visible
    await expect(completedCard.getByRole('button', { name: /Recensera kund/i })).toBeVisible();
  });

  test('should submit review with rating and comment', async ({ page }) => {
    await navigateToCompletedBookings(page);

    // Find the first completed booking with an unsubmitted review
    const completedCard = page.locator('[data-testid="booking-item"]').filter({ hasText: /Genomförd/ }).first();
    const reviewBtn = completedCard.getByRole('button', { name: /Recensera kund/i });

    // Skip if review already exists (button won't be visible)
    const reviewBtnVisible = await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!reviewBtnVisible) {
      // Check if "Din recension:" is shown instead (review already submitted)
      const existingReview = await completedCard.getByText(/Din recension:/i).isVisible().catch(() => false);
      if (existingReview) {
        test.skip(true, 'Review already submitted for this booking');
        return;
      }
    }

    await reviewBtn.click();

    // Dialog should open
    await expect(page.getByRole('heading', { name: /Recensera kund/i })).toBeVisible({ timeout: 5000 });

    // Click 5th star (rating 5)
    await page.getByRole('button', { name: '5 av 5 stjärnor' }).click();

    // "Utmärkt" label should appear
    await expect(page.getByText('Utmärkt')).toBeVisible();

    // Add a comment
    await page.getByPlaceholder(/Beskriv din upplevelse av kunden/i).fill('Mycket trevlig kund, alltid i tid');

    // Submit
    await page.getByRole('button', { name: /Skicka recension/i }).click();

    // Dialog should close
    await expect(page.getByRole('heading', { name: /Recensera kund/i })).not.toBeVisible({ timeout: 10000 });

    // Success toast
    await expect(page.getByText(/Recension skickad/i)).toBeVisible({ timeout: 5000 });
  });

  test('should require rating', async ({ page }) => {
    await navigateToCompletedBookings(page);

    // Find a completed booking that still has the review button (not yet reviewed)
    const completedCards = page.locator('[data-testid="booking-item"]').filter({ hasText: /Genomförd/ });
    const cardCount = await completedCards.count();

    // Look through cards to find one with review button
    let reviewBtn = null;
    for (let i = 0; i < cardCount; i++) {
      const card = completedCards.nth(i);
      const btn = card.getByRole('button', { name: /Recensera kund/i });
      const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
      if (visible) {
        reviewBtn = btn;
        break;
      }
    }

    if (!reviewBtn) {
      test.skip(true, 'No unreviewd completed bookings available');
      return;
    }

    await reviewBtn.click();

    // Dialog should open
    await expect(page.getByRole('heading', { name: /Recensera kund/i })).toBeVisible({ timeout: 5000 });

    // Try to submit without rating -- button should be disabled
    const submitBtn = page.getByRole('button', { name: /Skicka recension/i });
    await expect(submitBtn).toBeDisabled();

    // Close dialog
    await page.getByRole('button', { name: /Avbryt/i }).click();
  });

  test('should show existing review', async ({ page }) => {
    await navigateToCompletedBookings(page);

    // Find completed booking cards and look for one with a review
    const completedCards = page.locator('[data-testid="booking-item"]').filter({ hasText: /Genomförd/ });
    const cardCount = await completedCards.count();

    let reviewedCard = null;
    for (let i = 0; i < cardCount; i++) {
      const card = completedCards.nth(i);
      const hasReview = await card.getByText(/Din recension:/i).isVisible({ timeout: 2000 }).catch(() => false);
      if (hasReview) {
        reviewedCard = card;
        break;
      }
    }

    if (reviewedCard) {
      // Verify review is shown
      await expect(reviewedCard.getByText(/Din recension:/i)).toBeVisible();
      // "Recensera kund" button should NOT be visible
      await expect(reviewedCard.getByRole('button', { name: /Recensera kund/i })).not.toBeVisible();
    } else {
      // No review found -- submit one inline on the first card
      const firstCard = completedCards.first();
      const reviewBtn = firstCard.getByRole('button', { name: /Recensera kund/i });
      const reviewBtnVisible = await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false);

      if (reviewBtnVisible) {
        await reviewBtn.click();
        await page.getByRole('button', { name: '4 av 5 stjärnor' }).click();
        await page.getByRole('button', { name: /Skicka recension/i }).click();
        await expect(page.getByRole('heading', { name: /Recensera kund/i })).not.toBeVisible({ timeout: 10000 });

        // Verify the review shows
        await expect(firstCard.getByText(/Din recension:/i)).toBeVisible({ timeout: 5000 });
        await expect(firstCard.getByRole('button', { name: /Recensera kund/i })).not.toBeVisible();
      }
    }
  });
});
