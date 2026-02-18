import { test, expect } from './fixtures';
import { seedBooking, cleanupSpecData, getBaseEntities } from './setup/seed-helpers';

const SPEC_TAG = 'custinsight';

/**
 * E2E Tests for AI Customer Insights
 *
 * Tests:
 * 1. "Visa insikter" button visible in expanded customer card
 * 2. Click -> loading text -> AI insights displayed
 * 3. Insights show VIP badge + summary
 *
 * NOTE: These tests are marked as slow (30s timeout) because they call
 * the AI service. If the AI service is down, these tests will fail.
 *
 * Seed: 3 completed bookings to give the AI data to analyze.
 */

test.describe('Customer Insights (Provider)', () => {
  test.beforeAll(async () => {
    await cleanupSpecData(SPEC_TAG);
    const base = await getBaseEntities();

    // 3 completed bookings spread over time
    await seedBooking({
      specTag: SPEC_TAG,
      status: 'completed',
      daysFromNow: -30,
      horseName: 'E2E Insight Horse',
      horseId: base.horseId,
    });
    await seedBooking({
      specTag: SPEC_TAG,
      status: 'completed',
      daysFromNow: -60,
      horseName: 'E2E Insight Horse',
      horseId: base.horseId,
      startTime: '12:00',
      endTime: '13:00',
    });
    await seedBooking({
      specTag: SPEC_TAG,
      status: 'completed',
      daysFromNow: -90,
      horseName: 'E2E Insight Horse',
      horseId: base.horseId,
      startTime: '14:00',
      endTime: '15:00',
    });
  });

  test.afterAll(async () => {
    await cleanupSpecData(SPEC_TAG);
  });

  test.beforeEach(async ({ page }) => {
    // Reset rate limits to avoid 429 after many preceding tests
    await page.request.post('/api/test/reset-rate-limit').catch(() => {});

    await page.goto('/login');
    await page.getByLabel(/email/i).fill('provider@example.com');
    await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!');
    await page.getByRole('button', { name: /logga in/i }).click();
    await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 10000 });
  });

  // Helper: expand customer card on /provider/customers
  async function expandCustomerCard(page: import('@playwright/test').Page) {
    await page.goto('/provider/customers');
    await expect(page.getByRole('heading', { name: /^Kunder$/i })).toBeVisible({ timeout: 10000 });

    // Customer entry is a button element (the whole row is clickable)
    const customerEntry = page.getByRole('button', { name: /Test Testsson/ }).first();
    await expect(customerEntry).toBeVisible({ timeout: 10000 });
    await customerEntry.click();
    await page.waitForTimeout(500);
  }

  test('should show "Visa insikter" button in expanded customer card', async ({ page }) => {
    await expandCustomerCard(page);

    // "Visa insikter" button should be visible in the expanded section
    await expect(page.getByRole('button', { name: /Visa insikter/i })).toBeVisible({ timeout: 5000 });
  });

  test('should load and display AI insights', async ({ page }) => {
    test.slow(); // Allow 30s for AI response

    await expandCustomerCard(page);

    // Click "Visa insikter"
    await page.getByRole('button', { name: /Visa insikter/i }).click();

    // Loading text should appear
    await expect(page.getByText(/Analyserar kunddata/i)).toBeVisible({ timeout: 5000 });

    // Wait for AI response (up to 30s)
    await expect(page.getByText('AI-insikter')).toBeVisible({ timeout: 30000 });
  });

  test('should show VIP badge and summary in insights', async ({ page }) => {
    test.slow(); // Allow 30s for AI response

    await expandCustomerCard(page);

    // Click "Visa insikter"
    await page.getByRole('button', { name: /Visa insikter/i }).click();

    // Wait for insights to load
    await expect(page.getByText('AI-insikter')).toBeVisible({ timeout: 30000 });

    // VIP badge should be visible (one of: VIP, Stamkund, Normal)
    const hasBadge = await page.getByText(/^(VIP|Stamkund|Normal)$/).first().isVisible({ timeout: 5000 });
    expect(hasBadge).toBe(true);

    // "Vanligaste tjänster" section should exist (shows top services)
    await expect(page.getByText('Vanligaste tjänster')).toBeVisible({ timeout: 5000 });
  });
});
