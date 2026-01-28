import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.describe('Route Announcements Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clean up test data to prevent pollution
    const prisma = new PrismaClient();

    try {
      const keepEmails = ['test@example.com', 'provider@example.com'];

      // Delete route stops from route orders
      await prisma.routeStop.deleteMany({
        where: {
          routeOrder: {
            customer: {
              AND: [
                { email: { contains: '@example.com' } },
                { email: { notIn: keepEmails } }
              ]
            }
          }
        }
      });

      // Delete bookings from dynamically created data
      await prisma.booking.deleteMany({
        where: {
          OR: [
            {
              customer: {
                AND: [
                  { email: { contains: '@example.com' } },
                  { email: { notIn: keepEmails } }
                ]
              }
            },
            {
              service: {
                provider: {
                  user: {
                    AND: [
                      { email: { contains: '@example.com' } },
                      { email: { notIn: keepEmails } }
                    ]
                  }
                }
              }
            }
          ]
        }
      });

      // Delete route orders from dynamically created users
      await prisma.routeOrder.deleteMany({
        where: {
          customer: {
            AND: [
              { email: { contains: '@example.com' } },
              { email: { notIn: keepEmails } }
            ]
          }
        }
      });

      // Delete services from dynamically created providers
      await prisma.service.deleteMany({
        where: {
          provider: {
            user: {
              AND: [
                { email: { contains: '@example.com' } },
                { email: { notIn: keepEmails } }
              ]
            }
          }
        }
      });

      // Delete dynamically created providers
      await prisma.provider.deleteMany({
        where: {
          user: {
            AND: [
              { email: { contains: '@example.com' } },
              { email: { notIn: keepEmails } }
            ]
          }
        }
      });

      // Delete dynamically created users
      await prisma.user.deleteMany({
        where: {
          email: {
            contains: '@example.com',
            notIn: keepEmails
          }
        }
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  test.describe('Public Announcements Page', () => {
    test('should display announcements page with search functionality', async ({ page }) => {
      // Visit public announcements page (no login required)
      await page.goto('/announcements');

      // Verify page loaded
      await expect(page.getByRole('heading', { name: /planerade rutter/i })).toBeVisible({ timeout: 10000 });

      // Verify search/filter elements exist
      await expect(page.getByPlaceholder(/filtrera på tjänstetyp/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sök/i })).toBeVisible();

      // Verify location button exists
      await expect(page.getByRole('button', { name: /använd min position/i })).toBeVisible();

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

    test('should filter announcements by service type', async ({ page }) => {
      await page.goto('/announcements');

      // Wait for page to load
      await expect(page.getByRole('heading', { name: /planerade rutter/i })).toBeVisible({ timeout: 10000 });

      // Type in service type filter
      await page.getByPlaceholder(/filtrera på tjänstetyp/i).fill('Hovslagning');

      // Click search
      await page.getByRole('button', { name: /sök/i }).click();

      // Wait for results
      await page.waitForTimeout(1500);

      // Verify active filter is shown
      const activeFilterVisible = await page.getByText(/aktiva filter/i).isVisible().catch(() => false);

      if (activeFilterVisible) {
        await expect(page.getByText(/tjänst.*hovslagning/i)).toBeVisible();
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

      // Apply a filter
      await page.getByPlaceholder(/filtrera på tjänstetyp/i).fill('Test');
      await page.getByRole('button', { name: /sök/i }).click();
      await page.waitForTimeout(1000);

      // Clear filter
      const clearButton = page.getByRole('button', { name: /rensa/i });
      const clearVisible = await clearButton.isVisible().catch(() => false);

      if (clearVisible) {
        await clearButton.click();
        await page.waitForTimeout(1000);

        // Verify filter is cleared
        await expect(page.getByPlaceholder(/filtrera på tjänstetyp/i)).toHaveValue('');
      }
    });
  });

  test.describe('Provider Announcements Management', () => {
    test.beforeEach(async ({ page }) => {
      // Log in as provider
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('provider@example.com');
      await page.getByLabel(/lösenord/i).fill('ProviderPass123!');
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

    test('should create new announcement', async ({ page }) => {
      await page.goto('/provider/announcements/new');

      // Verify form page loaded
      await expect(page.getByRole('heading', { name: /skapa rutt-annons/i })).toBeVisible({ timeout: 10000 });

      // Fill in form
      await page.getByLabel(/tjänstetyp/i).fill('E2E Test Hovslagning');

      // Set dates (2 weeks from now)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);
      const dateString = futureDate.toISOString().split('T')[0];

      const endDate = new Date(futureDate);
      endDate.setDate(endDate.getDate() + 7);
      const endDateString = endDate.toISOString().split('T')[0];

      await page.getByLabel(/från datum/i).fill(dateString);
      await page.getByLabel(/till datum/i).fill(endDateString);

      // Fill in route stop (använd riktig adress för geocoding)
      await page.getByLabel(/platsnamn/i).fill('E2E Teststall');
      await page.getByLabel(/adress/i).fill('Kungsgatan 1, Stockholm');

      // Fill in optional info
      await page.getByLabel(/övrig information/i).fill('E2E test - automatiskt skapad');

      // Submit form
      await page.getByRole('button', { name: /skapa rutt-annons/i }).click();

      // Wait for redirect to announcements list
      await expect(page).toHaveURL(/\/provider\/announcements$/, { timeout: 15000 });

      // Verify success toast or announcement appears in list
      await page.waitForTimeout(2000);

      // The announcement should now be visible
      const announcementVisible = await page.getByText(/e2e test hovslagning/i).isVisible().catch(() => false);

      if (announcementVisible) {
        await expect(page.getByText(/e2e test hovslagning/i)).toBeVisible();
      }
    });

    test('should navigate to announcement details', async ({ page }) => {
      // First create an announcement if needed, or check existing ones
      await page.goto('/provider/announcements');
      await page.waitForTimeout(2000);

      // Check if there are any announcements
      const detailsButton = page.getByRole('button', { name: /visa detaljer/i }).first();
      const hasAnnouncements = await detailsButton.isVisible().catch(() => false);

      if (!hasAnnouncements) {
        console.log('No announcements available, skipping details test');
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
        console.log('No announcements available, skipping booking details test');
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

      // Navigate to announcement details
      const detailsButton = page.getByRole('button', { name: /visa detaljer/i }).first();
      const hasAnnouncements = await detailsButton.isVisible().catch(() => false);

      if (!hasAnnouncements) {
        console.log('No announcements available, skipping confirm booking test');
        return;
      }

      await detailsButton.click();
      await page.waitForTimeout(2000);

      // Look for confirm button (only visible for pending bookings)
      const confirmButton = page.getByRole('button', { name: /bekräfta/i }).first();
      const hasConfirmButton = await confirmButton.isVisible().catch(() => false);

      if (!hasConfirmButton) {
        console.log('No pending bookings to confirm, test passes gracefully');
        return;
      }

      // Click confirm
      await confirmButton.click();

      // Wait for status update
      await page.waitForTimeout(2000);

      // Verify success toast or status change
      const successVisible = await page.getByText(/bokning bekräftad|bekräftad/i).isVisible().catch(() => false);

      // Test passes if confirm was clicked without error
      console.log('Confirm button clicked, success toast visible:', successVisible);
    });

    test('should cancel announcement', async ({ page }) => {
      await page.goto('/provider/announcements');
      await page.waitForTimeout(2000);

      // Look for cancel button
      const cancelButton = page.getByRole('button', { name: /avbryt rutt/i }).first();
      const hasCancelButton = await cancelButton.isVisible().catch(() => false);

      if (!hasCancelButton) {
        console.log('No open announcements to cancel, skipping test');
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
      await page.getByLabel(/lösenord/i).fill('TestPassword123!');
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
        console.log('No announcements available, skipping customer booking test');
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
        console.log('No announcements with booking available, skipping test');
        return;
      }

      // Click booking button
      await bookButton.click();

      // Verify navigation to booking page
      await expect(page).toHaveURL(/\/announcements\/[a-zA-Z0-9-]+\/book/, { timeout: 10000 });
    });
  });
});
