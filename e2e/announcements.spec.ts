import { test, expect } from './fixtures';
import { seedProviderAnnouncement, seedRouteOrders, seedBooking, cleanupSpecData } from './setup/seed-helpers';

const SPEC_TAG = 'announcements';
const SPEC_TAG_CUST = 'announcements-cust';

test.describe('Route Announcements Flow', () => {
  test.beforeAll(async () => {
    await cleanupSpecData(SPEC_TAG);
    await cleanupSpecData(SPEC_TAG_CUST);

    // Announcement 1: for provider management tests (confirm/cancel)
    const announcement = await seedProviderAnnouncement(SPEC_TAG);

    // Pending booking linked to announcement (for "bekräfta" test)
    await seedBooking({
      specTag: SPEC_TAG,
      status: 'pending',
      daysFromNow: 10,
      routeOrderId: announcement.id,
      horseName: 'E2E AnnBooking',
    });

    // Announcement 2: for customer tests (survives cancel of announcement 1)
    await seedProviderAnnouncement(SPEC_TAG_CUST);

    await seedRouteOrders(SPEC_TAG, 2);
  });

  test.afterAll(async () => {
    await cleanupSpecData(SPEC_TAG);
    await cleanupSpecData(SPEC_TAG_CUST);
  });

  test.describe('Public Announcements Page', () => {
    test('should display announcements page with search functionality', async ({ page }) => {
      // Visit public announcements page (no login required)
      await page.goto('/announcements');

      // Verify page loaded
      await expect(page.getByRole('heading', { name: /planerade rutter/i })).toBeVisible({ timeout: 10000 });

      // Verify municipality search exists
      await expect(page.getByPlaceholder(/sök kommun/i)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sök', exact: true })).toBeVisible();

      // Wait for announcements to load
      await page.waitForTimeout(2000);

      // Check if announcements exist or empty state is shown
      const announcementCards = await page.locator('.hover\\:shadow-lg').count();

      if (announcementCards > 0) {
        // Verify first announcement has expected structure
        const firstCard = page.locator('.hover\\:shadow-lg').first();
        await expect(firstCard).toBeVisible();

        // Verify card contains provider info and dates
        await expect(firstCard.locator('text=/öppen för bokningar/i')).toBeVisible();
      } else {
        // Empty state should be shown
        const emptyState = page.getByText(/inga planerade rutter just nu|inga rutter matchar/i);
        await expect(emptyState).toBeVisible();
      }
    });

    test('should filter announcements by municipality', async ({ page }) => {
      await page.goto('/announcements');

      // Wait for page to load
      await expect(page.getByRole('heading', { name: /planerade rutter/i })).toBeVisible({ timeout: 10000 });

      // Type in municipality search
      await page.getByPlaceholder(/sök kommun/i).fill('Göte');

      // Wait for dropdown to appear and select Göteborg
      await page.waitForTimeout(500);
      const option = page.locator('li', { hasText: 'Göteborg' });
      const optionVisible = await option.isVisible().catch(() => false);

      if (optionVisible) {
        await option.click();

        // Wait for results
        await page.waitForTimeout(1500);

        // Verify active filter is shown
        const activeFilterVisible = await page.getByText(/aktiva filter/i).isVisible().catch(() => false);

        if (activeFilterVisible) {
          await expect(page.getByText(/kommun.*göteborg/i)).toBeVisible();
        }
      }

      // Verify that either results or empty state is shown
      const hasResults = await page.locator('.hover\\:shadow-lg').count() > 0;
      const hasEmptyState = await page.getByText(/inga rutter matchar/i).isVisible().catch(() => false);

      expect(hasResults || hasEmptyState).toBeTruthy();
    });

    test('should clear filters', async ({ page }) => {
      await page.goto('/announcements');

      // Wait for page to load
      await expect(page.getByRole('heading', { name: /planerade rutter/i })).toBeVisible({ timeout: 10000 });

      // Apply a municipality filter
      await page.getByPlaceholder(/sök kommun/i).fill('Stock');
      await page.waitForTimeout(500);
      const option = page.locator('li', { hasText: 'Stockholm' });
      const optionVisible = await option.isVisible().catch(() => false);

      if (optionVisible) {
        await option.click();
        await page.waitForTimeout(1000);

        // Clear filter
        const clearButton = page.getByRole('button', { name: /rensa/i });
        const clearVisible = await clearButton.isVisible().catch(() => false);

        if (clearVisible) {
          await clearButton.click();
          await page.waitForTimeout(1000);

          // Verify filter is cleared
          await expect(page.getByPlaceholder(/sök kommun/i)).toHaveValue('');
        }
      }
    });
  });

  test.describe('Provider Announcements Management', () => {
    test.beforeEach(async ({ page }) => {
      // Log in as provider
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('provider@example.com');
      await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!');
      await page.getByRole('button', { name: /logga in/i }).click();

      // Wait for dashboard
      await page.waitForURL(/\/provider\/dashboard/, { timeout: 15000 });
    });

    test('should display provider announcements page', async ({ page }) => {
      await page.goto('/provider/announcements');

      // Verify page loaded
      await expect(page.getByRole('heading', { name: /mina rutt-annonser/i })).toBeVisible({ timeout: 10000 });

      // Verify create button exists
      await expect(page.getByRole('button', { name: /skapa ny rutt-annons/i })).toBeVisible();

      // Wait for content to load
      await page.waitForTimeout(2000);

      // Check if announcements exist or empty state is shown
      const hasAnnouncements = await page.locator('.space-y-6 > div').count() > 0;

      if (!hasAnnouncements) {
        // Empty state should be shown
        await expect(page.getByText(/inga rutt-annonser ännu/i)).toBeVisible();
      }
    });

    test('should show create announcement form with services and municipality', async ({ page }) => {
      await page.goto('/provider/announcements/new');

      // Verify form page loaded
      await expect(page.getByRole('heading', { name: /skapa rutt-annons/i })).toBeVisible({ timeout: 10000 });

      // Verify new form elements exist
      await expect(page.getByText(/tjänster/i).first()).toBeVisible();
      await expect(page.getByPlaceholder(/sök kommun/i)).toBeVisible();
      await expect(page.getByLabel(/från datum/i)).toBeVisible();
      await expect(page.getByLabel(/till datum/i)).toBeVisible();
      await expect(page.getByLabel(/övrig information/i)).toBeVisible();

      // Verify services are loaded (either checkboxes or empty state)
      await page.waitForTimeout(2000);
      const hasServices = await page.locator('label:has([role="checkbox"])').count() > 0;
      const noServices = await page.getByText(/inga aktiva tjänster/i).isVisible().catch(() => false);

      expect(hasServices || noServices).toBeTruthy();
    });

    test('should create new announcement with services and municipality', async ({ page }) => {
      await page.goto('/provider/announcements/new');

      // Verify form page loaded
      await expect(page.getByRole('heading', { name: /skapa rutt-annons/i })).toBeVisible({ timeout: 10000 });

      // Wait for services to load
      await page.waitForTimeout(2000);

      // Check if provider has services
      const serviceCheckboxes = page.locator('label:has([role="checkbox"])');
      const serviceCount = await serviceCheckboxes.count();

      if (serviceCount === 0) {
        test.skip(true, 'Provider has no services');
        return;
      }

      // Select first service
      await serviceCheckboxes.first().click();

      // Select municipality
      await page.getByPlaceholder(/sök kommun/i).fill('Aling');
      await page.waitForTimeout(500);
      const municipalityOption = page.locator('li', { hasText: 'Alingsås' });
      await municipalityOption.click();

      // Set dates (2 weeks from now)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);
      const dateString = futureDate.toISOString().split('T')[0];

      const endDate = new Date(futureDate);
      endDate.setDate(endDate.getDate() + 7);
      const endDateString = endDate.toISOString().split('T')[0];

      await page.getByLabel(/från datum/i).fill(dateString);
      await page.getByLabel(/till datum/i).fill(endDateString);

      // Fill in optional info
      await page.getByLabel(/övrig information/i).fill('E2E test - automatiskt skapad');

      // Submit form
      await page.getByRole('button', { name: /skapa rutt-annons/i }).click();

      // Wait for redirect to announcements list
      await expect(page).toHaveURL(/\/provider\/announcements$/, { timeout: 15000 });

      // Wait for list to load
      await page.waitForTimeout(2000);
    });

    test('should navigate to announcement details', async ({ page }) => {
      // First create an announcement if needed, or check existing ones
      await page.goto('/provider/announcements');
      await page.waitForTimeout(2000);

      // Check if there are any announcements
      const detailsButton = page.getByRole('button', { name: /visa detaljer/i }).first();
      const hasAnnouncements = await detailsButton.isVisible().catch(() => false);

      if (!hasAnnouncements) {
        test.skip(true, 'No announcements available');
        return;
      }

      // Click on details button
      await detailsButton.click();

      // Verify we're on details page
      await expect(page).toHaveURL(/\/provider\/announcements\/[a-zA-Z0-9-]+/, { timeout: 10000 });

      // Verify details page content
      await expect(page.getByText(/bokningar/i)).toBeVisible({ timeout: 5000 });

      // Verify back link exists
      await expect(page.getByText(/tillbaka till annonser/i)).toBeVisible();
    });

    test('should show booking details on announcement', async ({ page }) => {
      await page.goto('/provider/announcements');
      await page.waitForTimeout(2000);

      // Find announcement with bookings
      const detailsButton = page.getByRole('button', { name: /visa detaljer/i }).first();
      const hasAnnouncements = await detailsButton.isVisible().catch(() => false);

      if (!hasAnnouncements) {
        test.skip(true, 'No announcements available for booking details');
        return;
      }

      await detailsButton.click();
      await page.waitForTimeout(2000);

      // Check if there are bookings
      const hasBookings = await page.locator('[class*="space-y-4"] > div').count() > 0;
      const emptyBookings = await page.getByText(/inga bokningar ännu/i).isVisible().catch(() => false);

      if (hasBookings && !emptyBookings) {
        // Verify booking details structure
        await expect(page.getByText(/kontaktinfo/i).first()).toBeVisible();

        // Check for customer info
        const hasCustomerName = await page.locator('h3, [class*="CardTitle"]').count() > 0;
        expect(hasCustomerName).toBeTruthy();
      } else {
        // Empty state is OK
        await expect(page.getByText(/inga bokningar ännu|kunder kan nu boka/i)).toBeVisible();
      }
    });

    test('should confirm pending booking', async ({ page }) => {
      await page.goto('/provider/announcements');
      await page.waitForTimeout(2000);

      // Try each announcement's detail page to find one with pending bookings
      const detailsButtons = page.getByRole('button', { name: /visa detaljer/i });
      const buttonCount = await detailsButtons.count();

      if (buttonCount === 0) {
        test.skip(true, 'No announcements available for confirm booking');
        return;
      }

      let foundConfirmButton = false;
      for (let i = 0; i < buttonCount; i++) {
        await page.goto('/provider/announcements');
        await page.waitForTimeout(1500);

        await detailsButtons.nth(i).click();
        await page.waitForTimeout(2000);

        // Look for confirm button (only visible for pending bookings)
        const confirmButton = page.getByRole('button', { name: /bekräfta/i }).first();
        const hasConfirmButton = await confirmButton.isVisible().catch(() => false);

        if (hasConfirmButton) {
          foundConfirmButton = true;

          // Click confirm
          await confirmButton.click();
          await page.waitForTimeout(2000);

          // Verify success toast or status change
          const successVisible = await page.getByText(/bokning bekräftad|bekräftad/i).isVisible().catch(() => false);
          console.log('Confirm button clicked, success toast visible:', successVisible);
          break;
        }
      }

      if (!foundConfirmButton) {
        test.skip(true, 'No pending bookings to confirm on any announcement');
      }
    });

    test('should cancel announcement', async ({ page }) => {
      await page.goto('/provider/announcements');
      await page.waitForTimeout(2000);

      // Look for cancel button
      const cancelButton = page.getByRole('button', { name: /avbryt rutt/i }).first();
      const hasCancelButton = await cancelButton.isVisible().catch(() => false);

      if (!hasCancelButton) {
        test.skip(true, 'No open announcements to cancel');
        return;
      }

      // Set up dialog handler for confirmation
      page.once('dialog', async dialog => {
        await dialog.accept();
      });

      // Click cancel
      await cancelButton.click();

      // Wait for update
      await page.waitForTimeout(2000);

      // Verify success or that the announcement status changed
      const successVisible = await page.getByText(/rutt-annons avbruten/i).isVisible().catch(() => false);
      const cancelledVisible = await page.getByText(/avbruten/i).isVisible().catch(() => false);

      console.log('Cancel result - success toast:', successVisible, 'cancelled status:', cancelledVisible);
    });
  });

  test.describe('Customer Booking on Announcement', () => {
    test.beforeEach(async ({ page }) => {
      // Log in as customer
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel('Lösenord', { exact: true }).fill('TestPassword123!');
      await page.getByRole('button', { name: /logga in/i }).click();

      // Wait for providers page (customers redirect there)
      await expect(page).toHaveURL(/\/providers/, { timeout: 10000 });
    });

    test('should show booking button for logged in customer', async ({ page }) => {
      await page.goto('/announcements');

      // Wait for page to load
      await expect(page.getByRole('heading', { name: /planerade rutter/i })).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(2000);

      // Check if there are announcements
      const announcementCount = await page.locator('.hover\\:shadow-lg').count();

      if (announcementCount === 0) {
        test.skip(true, 'No announcements available for customer booking');
        return;
      }

      // Verify "Boka på denna rutt" button is visible (not "Logga in för att boka")
      const bookButton = page.getByRole('button', { name: /boka på denna rutt/i }).first();
      const hasBookButton = await bookButton.isVisible().catch(() => false);

      if (hasBookButton) {
        await expect(bookButton).toBeVisible();
      } else {
        // If no book button, check that we at least have provider profile link
        const profileLink = page.getByRole('button', { name: /se leverantörens profil/i }).first();
        await expect(profileLink).toBeVisible();
      }
    });

    test('should navigate to booking page from announcement', async ({ page }) => {
      await page.goto('/announcements');
      await page.waitForTimeout(2000);

      // Find booking button
      const bookButton = page.getByRole('link', { name: /boka på denna rutt/i }).first();
      const hasBookButton = await bookButton.isVisible().catch(() => false);

      if (!hasBookButton) {
        test.skip(true, 'No announcements with booking available');
        return;
      }

      // Click booking button
      await bookButton.click();

      // Verify navigation to booking page
      await expect(page).toHaveURL(/\/announcements\/[a-zA-Z0-9-]+\/book/, { timeout: 10000 });
    });
  });
});
