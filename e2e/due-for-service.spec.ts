import { test, expect } from './fixtures';
import { seedBooking, cleanupSpecData, getBaseEntities } from './setup/seed-helpers';

const SPEC_TAG = 'due-for-service';

/**
 * E2E Tests for Due-for-Service (Besöksplanering)
 *
 * Tests:
 * - Display the page with heading, subtext, and summary cards
 * - Show overdue horse with correct info (E2E Blansen, 90 days ago, 8 week interval)
 * - Filter by status (Försenade / Alla)
 *
 * Requires: 1 completed booking 90 days ago + service with recommendedIntervalWeeks=8
 * 90 days ~= 12.8 weeks > 8 weeks interval = overdue by ~34 days
 */

test.describe('Due for Service (Provider)', () => {
  test.beforeAll(async () => {
    await cleanupSpecData(SPEC_TAG);
    const base = await getBaseEntities();
    await seedBooking({
      specTag: SPEC_TAG,
      status: 'completed',
      daysFromNow: -90,
      horseName: 'E2E Blansen',
      horseId: base.horseId,
    });
  });

  test.afterAll(async () => {
    await cleanupSpecData(SPEC_TAG);
  });

  test.beforeEach(async ({ page }) => {
    // Logga in som provider
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('provider@example.com');
    await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!');
    await page.getByRole('button', { name: /logga in/i }).click();
    await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 10000 });
  });

  test('should display due-for-service page', async ({ page }) => {
    await page.goto('/provider/due-for-service');

    // Rubrik
    await expect(page.getByRole('heading', { name: /besöksplanering/i })).toBeVisible({ timeout: 10000 });

    // Undertext
    await expect(page.getByText(/Hästar som snart behöver besök/i)).toBeVisible();

    // Vänta tills loading klar
    await expect(page.getByText(/Laddar besöksplanering/i)).not.toBeVisible({ timeout: 10000 });

    // Summary cards ska finnas (minst overdue)
    await expect(page.getByText('Försenade').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Inom 2 veckor').first()).toBeVisible();

    // Filterknappar
    await expect(page.getByRole('button', { name: 'Alla' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Försenade' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Inom 2 veckor' })).toBeVisible();
  });

  test('should show overdue horse with correct info', async ({ page }) => {
    await page.goto('/provider/due-for-service');

    await expect(page.getByRole('heading', { name: /besöksplanering/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Laddar besöksplanering/i)).not.toBeVisible({ timeout: 10000 });

    // E2E Blansen ska synas som overdue (90 dagar sedan, 8 veckors intervall)
    await expect(page.getByText('E2E Blansen')).toBeVisible({ timeout: 10000 });

    // Status badge "Försenad" (exact to avoid matching "Försenade" summary/filter)
    await expect(page.getByText('Försenad', { exact: true })).toBeVisible();

    // Intervall ska visa "8 veckor"
    await expect(page.getByText('8 veckor')).toBeVisible();

    // Service namn ska finnas
    await expect(page.getByText(/Hovslagning Standard/i)).toBeVisible();

    // "dagar försenad" text ska finnas
    await expect(page.getByText(/dagar försenad/i)).toBeVisible();
  });

  test('should filter by status', async ({ page }) => {
    await page.goto('/provider/due-for-service');

    await expect(page.getByRole('heading', { name: /besöksplanering/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Laddar besöksplanering/i)).not.toBeVisible({ timeout: 10000 });

    // Verifiera att E2E Blansen finns i "Alla"
    await expect(page.getByText('E2E Blansen')).toBeVisible({ timeout: 10000 });

    // Klicka "Försenade" filter
    await page.getByRole('button', { name: 'Försenade' }).click();

    // Vänta på API-svar
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Laddar besöksplanering/i)).not.toBeVisible({ timeout: 5000 });

    // E2E Blansen ska fortfarande synas (den är overdue)
    await expect(page.getByText('E2E Blansen')).toBeVisible({ timeout: 5000 });

    // Klicka "Alla" igen
    await page.getByRole('button', { name: 'Alla' }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Laddar besöksplanering/i)).not.toBeVisible({ timeout: 5000 });

    // E2E Blansen ska synas igen
    await expect(page.getByText('E2E Blansen')).toBeVisible({ timeout: 5000 });
  });
});
