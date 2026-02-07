import { test, expect } from './fixtures';

/**
 * E2E Tests for Customer Registry (Kundregister)
 *
 * Tests:
 * - Display the customer list page with correct heading/subtext
 * - Show customers from completed bookings (Test Testsson)
 * - Search customers by name
 * - Expand customer card to see details and horses
 *
 * Requires: 1 completed booking in seed data (customer: Test Testsson, horse: E2E Blansen)
 */

test.describe('Customer Registry (Provider)', () => {
  test.beforeEach(async ({ page }) => {
    // Logga in som provider
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('provider@example.com');
    await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!');
    await page.getByRole('button', { name: /logga in/i }).click();
    await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 10000 });
  });

  test('should display customer list page', async ({ page }) => {
    await page.goto('/provider/customers');

    // Rubrik
    await expect(page.getByRole('heading', { name: /kunder/i })).toBeVisible({ timeout: 10000 });

    // Undertext
    await expect(page.getByText(/Översikt över dina kunder och deras hästar/i)).toBeVisible();

    // Sökfält
    await expect(page.getByPlaceholder(/Sök på namn eller email/i)).toBeVisible();

    // Filterknappar (exact: true because "Inaktiva" contains "Aktiva")
    await expect(page.getByRole('button', { name: 'Alla', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aktiva', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Inaktiva', exact: true })).toBeVisible();
  });

  test('should show customers from completed bookings', async ({ page }) => {
    await page.goto('/provider/customers');

    // Vänta på att sidan laddas (spinner försvinner)
    await expect(page.getByRole('heading', { name: /kunder/i })).toBeVisible({ timeout: 10000 });

    // Vänta tills loading är klar
    await expect(page.getByText(/Laddar kunder/i)).not.toBeVisible({ timeout: 10000 });

    // Test Testsson ska finnas som kund (från completed booking)
    await expect(page.getByText('Test Testsson')).toBeVisible({ timeout: 10000 });

    // Email ska vara synlig
    await expect(page.getByText('test@example.com')).toBeVisible();

    // Booking count ska finnas (minst 1 bokning)
    await expect(page.getByText(/\d+ bokning/).first()).toBeVisible();
  });

  test('should search customers', async ({ page }) => {
    await page.goto('/provider/customers');
    await expect(page.getByRole('heading', { name: /kunder/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Laddar kunder/i)).not.toBeVisible({ timeout: 10000 });

    // Verifiera att Test Testsson finns innan sökning
    await expect(page.getByText('Test Testsson')).toBeVisible({ timeout: 10000 });

    // Sök på "Test"
    const searchInput = page.getByPlaceholder(/Sök på namn eller email/i);
    await searchInput.fill('Test');

    // Vänta lite för debounce/API call
    await page.waitForTimeout(1000);

    // Test Testsson ska fortfarande synas
    await expect(page.getByText('Test Testsson')).toBeVisible();

    // Sök på nåt som inte matchar
    await searchInput.clear();
    await searchInput.fill('nonexistentkund');

    // Wait for the customer list to update (API call + re-render)
    // Either the empty state message appears or "Test Testsson" disappears
    await expect(page.getByText(/Inga kunder matchar din sökning/i)).toBeVisible({ timeout: 10000 });
  });

  test('should expand customer and show details', async ({ page }) => {
    await page.goto('/provider/customers');
    await expect(page.getByRole('heading', { name: /kunder/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Laddar kunder/i)).not.toBeVisible({ timeout: 10000 });

    // Klicka på kunden för att expandera
    const customerCard = page.getByText('Test Testsson').first();
    await expect(customerCard).toBeVisible({ timeout: 10000 });
    await customerCard.click();

    // Expanderad sektion ska visa detaljer (uppercase labels)
    await expect(page.getByText('Telefon', { exact: true }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Antal bokningar', { exact: true }).first()).toBeVisible();

    // Häst-sektion ska finnas (E2E Blansen kopplad via completed booking med horseId)
    await expect(page.getByText('Hästar', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('E2E Blansen').first()).toBeVisible();
  });
});
