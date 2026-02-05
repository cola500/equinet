import { test, expect, prisma } from './fixtures';

test.describe('Provider Group Bookings - Geo Filtering', () => {
  test.describe.configure({ mode: 'serial' });

  let customerId: string;

  test.beforeEach(async ({ page }) => {
    // Find the test customer user
    const customer = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
      select: { id: true },
    });
    if (!customer) throw new Error('Test customer not found - run seed first');
    customerId = customer.id;

    // Cleanup handled by fixtures.ts afterEach
  });

  async function seedGroupRequest(overrides: {
    locationName: string;
    address: string;
    latitude: number;
    longitude: number;
    serviceType?: string;
  }) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const endDate = new Date(futureDate);
    endDate.setDate(endDate.getDate() + 7);

    return prisma.groupBookingRequest.create({
      data: {
        serviceType: overrides.serviceType ?? 'Hovslagning',
        locationName: overrides.locationName,
        address: overrides.address,
        latitude: overrides.latitude,
        longitude: overrides.longitude,
        dateFrom: futureDate,
        dateTo: endDate,
        maxParticipants: 6,
        status: 'open',
        inviteCode: `E2E${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        creatorId: customerId,
      },
    });
  }

  async function loginAsProvider(page: import('@playwright/test').Page) {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('provider@example.com');
    await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!');
    await page.getByRole('button', { name: /logga in/i }).click();
    await page.waitForURL(/\/provider\/dashboard/, { timeout: 15000 });
  }

  test('should display open group requests for provider', async ({ page }) => {
    // Seed 2 group requests
    await seedGroupRequest({
      locationName: 'E2E Stall Alpha',
      address: 'Stallvägen 1, Stockholm',
      latitude: 59.3293,
      longitude: 18.0686,
    });
    await seedGroupRequest({
      locationName: 'E2E Stall Beta',
      address: 'Hästgatan 2, Göteborg',
      latitude: 57.7089,
      longitude: 11.9746,
      serviceType: 'Tandvård',
    });

    await loginAsProvider(page);
    await page.goto('/provider/group-bookings');

    // Wait for page heading
    await expect(
      page.getByRole('heading', { name: /öppna grupprequests/i })
    ).toBeVisible({ timeout: 10000 });

    // Wait for data to load (loading spinner gone)
    await expect(page.getByText(/laddar grupprequests/i)).not.toBeVisible({ timeout: 10000 });

    // Verify both requests appear
    await expect(page.getByText('E2E Stall Alpha')).toBeVisible();
    await expect(page.getByText('E2E Stall Beta')).toBeVisible();
  });

  test('should display geo filter UI elements', async ({ page }) => {
    await loginAsProvider(page);
    await page.goto('/provider/group-bookings');

    await expect(
      page.getByRole('heading', { name: /öppna grupprequests/i })
    ).toBeVisible({ timeout: 10000 });

    // Verify filter UI: place search input
    await expect(
      page.getByPlaceholder(/ort, stad eller postnummer/i)
    ).toBeVisible();

    // Verify "Sök plats" button
    await expect(
      page.getByRole('button', { name: /sök plats/i })
    ).toBeVisible();

    // Verify "Använd min position" button
    await expect(
      page.getByRole('button', { name: /använd min position/i })
    ).toBeVisible();
  });

  test('should filter group requests by place search', async ({ page }) => {
    // Seed requests in Stockholm and Göteborg (~400km apart)
    await seedGroupRequest({
      locationName: 'E2E Stall Stockholm',
      address: 'Kungsgatan 1, Stockholm',
      latitude: 59.3293,
      longitude: 18.0686,
    });
    await seedGroupRequest({
      locationName: 'E2E Stall Göteborg',
      address: 'Avenyn 1, Göteborg',
      latitude: 57.7089,
      longitude: 11.9746,
    });

    await loginAsProvider(page);
    await page.goto('/provider/group-bookings');

    // Wait for both to load
    await expect(page.getByText('E2E Stall Stockholm')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('E2E Stall Göteborg')).toBeVisible();

    // Search for Stockholm
    await page.getByPlaceholder(/ort, stad eller postnummer/i).fill('Stockholm');
    await page.getByRole('button', { name: /sök plats/i }).click();

    // Wait for geocoding and filter to apply - the filter pill should appear
    await expect(
      page.getByText(/stockholm.*inom.*km/i)
    ).toBeVisible({ timeout: 15000 });

    // Stockholm request should be visible, Göteborg should be filtered out (>50km default)
    await expect(page.getByText('E2E Stall Stockholm')).toBeVisible();
    await expect(page.getByText('E2E Stall Göteborg')).not.toBeVisible();
  });

  test('should clear filter and show all requests', async ({ page }) => {
    // Seed requests far apart
    await seedGroupRequest({
      locationName: 'E2E Stall Norr',
      address: 'Norrvägen 1, Stockholm',
      latitude: 59.3293,
      longitude: 18.0686,
    });
    await seedGroupRequest({
      locationName: 'E2E Stall Syd',
      address: 'Sydvägen 1, Malmö',
      latitude: 55.6050,
      longitude: 13.0038,
    });

    await loginAsProvider(page);
    await page.goto('/provider/group-bookings');

    // Wait for both to load
    await expect(page.getByText('E2E Stall Norr')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('E2E Stall Syd')).toBeVisible();

    // Activate filter via place search
    await page.getByPlaceholder(/ort, stad eller postnummer/i).fill('Stockholm');
    await page.getByRole('button', { name: /sök plats/i }).click();

    // Wait for filter pill to appear
    await expect(
      page.getByText(/stockholm.*inom.*km/i)
    ).toBeVisible({ timeout: 15000 });

    // Malmö should be filtered out
    await expect(page.getByText('E2E Stall Syd')).not.toBeVisible();

    // Clear filter by clicking "x" on the pill
    await page.locator('button', { hasText: 'x' }).click();

    // Both should be visible again
    await expect(page.getByText('E2E Stall Norr')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('E2E Stall Syd')).toBeVisible();
  });

  test('should show empty state when no requests match filter', async ({ page }) => {
    // Seed a request only in Malmö
    await seedGroupRequest({
      locationName: 'E2E Stall Malmö',
      address: 'Storgatan 1, Malmö',
      latitude: 55.6050,
      longitude: 13.0038,
    });

    await loginAsProvider(page);
    await page.goto('/provider/group-bookings');

    // Wait for the request to load
    await expect(page.getByText('E2E Stall Malmö')).toBeVisible({ timeout: 10000 });

    // Search for Kiruna (very far from Malmö)
    await page.getByPlaceholder(/ort, stad eller postnummer/i).fill('Kiruna');
    await page.getByRole('button', { name: /sök plats/i }).click();

    // Wait for filter pill
    await expect(
      page.getByText(/kiruna.*inom.*km/i)
    ).toBeVisible({ timeout: 15000 });

    // Should show empty state message
    await expect(
      page.getByText(/inga grupprequests i detta område/i)
    ).toBeVisible({ timeout: 5000 });
  });
});
