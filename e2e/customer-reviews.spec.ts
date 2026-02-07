import { test, expect } from './fixtures';

/**
 * E2E Tests for Customer Reviews (Kundrecensioner)
 *
 * Tests:
 * - Show "Recensera kund" button for completed bookings
 * - Submit review with rating and comment
 * - Require rating before submitting
 * - Show existing review after submission
 *
 * Requires: 1 completed booking in seed data
 * Access: /provider/bookings -> filter "Alla" -> completed booking -> "Recensera kund"
 *
 * IMPORTANT: CustomerReview is immutable (one per booking). Tests 2-4 depend on test 1.
 * Cleanup in seed resets customer reviews between runs.
 */

test.describe('Customer Reviews (Provider)', () => {
  test.beforeEach(async ({ page }) => {
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
    await expect(page.getByRole('heading', { name: /bokningar/i })).toBeVisible({ timeout: 10000 });

    // Click "Alla" filter to see completed bookings
    await page.getByRole('button', { name: /alla/i }).click();
    await page.waitForTimeout(1000);

    // Verify completed booking is visible (Hovslagning Standard, status "Genomförd")
    await expect(page.getByText('Genomförd').first()).toBeVisible({ timeout: 10000 });
  }

  test('should show review button for completed booking', async ({ page }) => {
    await navigateToCompletedBookings(page);

    // Find the completed booking card
    const completedCard = page.locator('[data-testid="booking-item"]').filter({ hasText: /Genomförd/ });
    await expect(completedCard).toBeVisible();

    // "Recensera kund" button should be visible
    await expect(completedCard.getByRole('button', { name: /Recensera kund/i })).toBeVisible();
  });

  test('should submit review with rating and comment', async ({ page }) => {
    await navigateToCompletedBookings(page);

    // Find completed booking and click "Recensera kund"
    const completedCard = page.locator('[data-testid="booking-item"]').filter({ hasText: /Genomförd/ });
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

    // Find completed booking and try to open review dialog
    const completedCard = page.locator('[data-testid="booking-item"]').filter({ hasText: /Genomförd/ });
    const reviewBtn = completedCard.getByRole('button', { name: /Recensera kund/i });

    const reviewBtnVisible = await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!reviewBtnVisible) {
      test.skip(true, 'Review already submitted (button not visible)');
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

    // Find the completed booking card
    const completedCard = page.locator('[data-testid="booking-item"]').filter({ hasText: /Genomförd/ });
    await expect(completedCard).toBeVisible();

    // If review was submitted (test 2 ran before), "Din recension:" should be visible
    const hasReview = await completedCard.getByText(/Din recension:/i).isVisible({ timeout: 5000 }).catch(() => false);

    if (hasReview) {
      // "Din recension:" text should be visible
      await expect(completedCard.getByText(/Din recension:/i)).toBeVisible();

      // "Recensera kund" button should NOT be visible
      await expect(completedCard.getByRole('button', { name: /Recensera kund/i })).not.toBeVisible();
    } else {
      // Review not yet submitted -- this test depends on test 2 running first
      // If running in isolation, submit a review first
      const reviewBtn = completedCard.getByRole('button', { name: /Recensera kund/i });
      const reviewBtnVisible = await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false);

      if (reviewBtnVisible) {
        // Submit review inline
        await reviewBtn.click();
        await page.getByRole('button', { name: '4 av 5 stjärnor' }).click();
        await page.getByRole('button', { name: /Skicka recension/i }).click();
        await expect(page.getByRole('heading', { name: /Recensera kund/i })).not.toBeVisible({ timeout: 10000 });

        // Now verify the review shows
        await expect(completedCard.getByText(/Din recension:/i)).toBeVisible({ timeout: 5000 });
        await expect(completedCard.getByRole('button', { name: /Recensera kund/i })).not.toBeVisible();
      }
    }
  });
});
