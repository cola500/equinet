import { test, expect } from './fixtures';
import { seedBooking, cleanupSpecData, getBaseEntities } from './setup/seed-helpers';
import { prisma } from './fixtures';

const SPEC_TAG = 'reschedule';

/**
 * E2E Tests for Self-Service Rescheduling (Ombokning)
 *
 * Tests:
 * 1. Show "Omboka" button for confirmed future booking (customer)
 * 2. Open reschedule dialog with current time + calendar + time picker
 * 3. Complete rescheduling flow (desktop only -- calendar in dialog)
 * 4. Hide "Omboka" when max reschedules reached
 * 5. Hide "Omboka" when provider has disabled rescheduling
 * 6-8. Provider settings: toggle, window hours, approval
 *
 * Seed: 2 confirmed future bookings (one with rescheduleCount=2 for max test)
 */

test.describe('Reschedule (Customer)', () => {
  let bookingNormal: string;
  let bookingMaxed: string;

  test.beforeAll(async () => {
    await cleanupSpecData(SPEC_TAG);
    const base = await getBaseEntities();

    // Ensure provider has rescheduling enabled with defaults
    await prisma.provider.update({
      where: { id: base.providerId },
      data: {
        rescheduleEnabled: true,
        rescheduleWindowHours: 24,
        maxReschedules: 2,
        rescheduleRequiresApproval: false,
      },
    });

    // Booking 1: confirmed, future -- normal rescheduling
    const b1 = await seedBooking({
      specTag: SPEC_TAG,
      status: 'confirmed',
      daysFromNow: 14,
      horseName: 'E2E Reschedule1',
    });
    bookingNormal = b1.id;

    // Booking 2: confirmed, future -- at max reschedules (rescheduleCount = 2, maxReschedules = 2)
    const b2 = await seedBooking({
      specTag: SPEC_TAG,
      status: 'confirmed',
      daysFromNow: 21,
      horseName: 'E2E RescheduleMax',
      startTime: '12:00',
      endTime: '13:00',
      rescheduleCount: 2,
    });
    bookingMaxed = b2.id;
  });

  test.afterAll(async () => {
    // Restore provider reschedule settings to defaults
    const base = await getBaseEntities();
    await prisma.provider.update({
      where: { id: base.providerId },
      data: {
        rescheduleEnabled: true,
        rescheduleWindowHours: 24,
        maxReschedules: 2,
        rescheduleRequiresApproval: false,
      },
    });
    await cleanupSpecData(SPEC_TAG);
  });

  function loginAsCustomer(page: import('@playwright/test').Page) {
    return async () => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel('Lösenord', { exact: true }).fill('TestPassword123!');
      await page.getByRole('button', { name: /logga in/i }).click();
      await expect(page).toHaveURL(/\/providers/, { timeout: 10000 });
    };
  }

  test('should show "Omboka" button for confirmed future booking', async ({ page }) => {
    await loginAsCustomer(page)();

    await page.goto('/customer/bookings');
    await expect(page.getByRole('heading', { name: /mina bokningar/i })).toBeVisible({ timeout: 10000 });

    // Find the normal booking card
    const bookingCard = page.locator('[data-slot="card"]')
      .filter({ hasText: 'E2E Reschedule1' })
      .first();
    await expect(bookingCard).toBeVisible({ timeout: 10000 });

    // "Omboka" button should be visible
    await expect(bookingCard.getByRole('button', { name: 'Omboka' })).toBeVisible();
  });

  test('should open reschedule dialog with current time and calendar', async ({ page }) => {
    await loginAsCustomer(page)();

    await page.goto('/customer/bookings');
    await expect(page.getByRole('heading', { name: /mina bokningar/i })).toBeVisible({ timeout: 10000 });

    const bookingCard = page.locator('[data-slot="card"]')
      .filter({ hasText: 'E2E Reschedule1' })
      .first();
    await expect(bookingCard).toBeVisible({ timeout: 10000 });

    // Click "Omboka"
    await bookingCard.getByRole('button', { name: 'Omboka' }).click();

    // Dialog should open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Title
    await expect(dialog.getByRole('heading', { name: /Omboka/i })).toBeVisible();

    // "Nuvarande tid:" label
    await expect(dialog.getByText('Nuvarande tid:')).toBeVisible();

    // Calendar grid
    await expect(dialog.getByRole('grid').first()).toBeVisible();

    // "Bekräfta ombokning" button
    await expect(dialog.getByRole('button', { name: /Bekräfta ombokning/i })).toBeVisible();

    // Close
    await dialog.getByRole('button', { name: /Avbryt/i }).click();
  });

  test('should complete rescheduling flow', async ({ page, isMobile }) => {
    // Calendar in dialog is hard to interact with on mobile
    test.skip(!!isMobile, 'Calendar interaction in dialog difficult on mobile');

    await loginAsCustomer(page)();

    await page.goto('/customer/bookings');
    await expect(page.getByRole('heading', { name: /mina bokningar/i })).toBeVisible({ timeout: 10000 });

    const bookingCard = page.locator('[data-slot="card"]')
      .filter({ hasText: 'E2E Reschedule1' })
      .first();
    await expect(bookingCard).toBeVisible({ timeout: 10000 });

    await bookingCard.getByRole('button', { name: 'Omboka' }).click();
    await expect(page.getByRole('heading', { name: /Omboka/i })).toBeVisible({ timeout: 5000 });

    // Pick a date further in the future by clicking next month arrow, then a day
    const nextMonthBtn = page.getByRole('button', { name: 'Go to the Next Month' });
    await nextMonthBtn.click();
    await page.waitForTimeout(500);

    // Click on day 18 (a weekday in next month)
    const dayButton = page.getByRole('gridcell', { name: /18/ }).first();
    await dayButton.click();

    // Change time
    const timeInput = page.getByRole('textbox', { name: /ny tid/i });
    await timeInput.fill('14:00');

    // Submit
    await page.getByRole('button', { name: /Bekräfta ombokning/i }).click();

    // Success toast
    await expect(page.getByText(/Bokningen har ombokats/i)).toBeVisible({ timeout: 10000 });
  });

  test('should hide "Omboka" when max reschedules reached', async ({ page }) => {
    await loginAsCustomer(page)();

    await page.goto('/customer/bookings');
    await expect(page.getByRole('heading', { name: /mina bokningar/i })).toBeVisible({ timeout: 10000 });

    // Find the maxed-out booking card
    const bookingCard = page.locator('[data-slot="card"]')
      .filter({ hasText: 'E2E RescheduleMax' })
      .first();
    await expect(bookingCard).toBeVisible({ timeout: 10000 });

    // "Omboka" button should NOT be visible (rescheduleCount >= maxReschedules)
    await expect(bookingCard.getByRole('button', { name: 'Omboka' })).not.toBeVisible();
  });

  test('should hide "Omboka" when provider disabled rescheduling', async ({ page }) => {
    const base = await getBaseEntities();

    // Disable rescheduling for the provider
    await prisma.provider.update({
      where: { id: base.providerId },
      data: { rescheduleEnabled: false },
    });

    await loginAsCustomer(page)();

    await page.goto('/customer/bookings');
    await expect(page.getByRole('heading', { name: /mina bokningar/i })).toBeVisible({ timeout: 10000 });

    // Find the normal booking card
    const bookingCard = page.locator('[data-slot="card"]')
      .filter({ hasText: 'E2E Reschedule' })
      .first();
    await expect(bookingCard).toBeVisible({ timeout: 10000 });

    // "Omboka" button should NOT be visible
    await expect(bookingCard.getByRole('button', { name: 'Omboka' })).not.toBeVisible();

    // Re-enable for other tests
    await prisma.provider.update({
      where: { id: base.providerId },
      data: { rescheduleEnabled: true },
    });
  });
});

test.describe('Reschedule Settings (Provider)', () => {
  test.beforeAll(async () => {
    const base = await getBaseEntities();
    // Ensure known starting state
    await prisma.provider.update({
      where: { id: base.providerId },
      data: {
        rescheduleEnabled: true,
        rescheduleWindowHours: 24,
        maxReschedules: 2,
        rescheduleRequiresApproval: false,
      },
    });
  });

  test.afterAll(async () => {
    // Restore defaults
    const base = await getBaseEntities();
    await prisma.provider.update({
      where: { id: base.providerId },
      data: {
        rescheduleEnabled: true,
        rescheduleWindowHours: 24,
        maxReschedules: 2,
        rescheduleRequiresApproval: false,
      },
    });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('provider@example.com');
    await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!');
    await page.getByRole('button', { name: /logga in/i }).click();
    await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 10000 });
  });

  test('should toggle "Tillåt ombokning"', async ({ page }) => {
    await page.goto('/provider/profile');

    // Find the reschedule settings card
    await expect(page.getByText('Ombokningsinställningar')).toBeVisible({ timeout: 10000 });

    // "Tillåt ombokning" label should be visible
    await expect(page.getByText('Tillåt ombokning')).toBeVisible();

    // Find the switch by its id
    const rescheduleSwitch = page.locator('#reschedule-enabled');
    await expect(rescheduleSwitch).toBeVisible();

    // It should be checked (enabled by default from our setup)
    await expect(rescheduleSwitch).toBeChecked();

    // Toggle off
    await rescheduleSwitch.click();

    // Wait for API call
    await expect(page.getByText(/Ombokning är avstängt/i)).toBeVisible({ timeout: 5000 });

    // Toggle back on
    await rescheduleSwitch.click();
    await expect(page.getByText(/Kunder kan nu omboka/i)).toBeVisible({ timeout: 5000 });
  });

  test('should change reschedule window hours', async ({ page }) => {
    await page.goto('/provider/profile');
    await expect(page.getByText('Ombokningsinställningar')).toBeVisible({ timeout: 10000 });

    // "Ombokningsfönster" label
    await expect(page.getByText('Ombokningsfönster')).toBeVisible();

    // Open the select dropdown for window hours
    const windowTrigger = page.locator('.space-y-2').filter({ hasText: 'Ombokningsfönster' }).locator('button[role="combobox"]');
    await windowTrigger.click();

    // Select 48 timmar
    await page.getByRole('option', { name: '48 timmar' }).click();

    // Success toast
    await expect(page.getByText(/Ombokningsfönster uppdaterat/i)).toBeVisible({ timeout: 5000 });
  });

  test('should toggle "Kräv godkännande"', async ({ page }) => {
    await page.goto('/provider/profile');
    await expect(page.getByText('Ombokningsinställningar')).toBeVisible({ timeout: 10000 });

    // "Kräv godkännande" label
    await expect(page.getByText('Kräv godkännande')).toBeVisible();

    // Find the approval switch
    const approvalSwitch = page.locator('#reschedule-approval');
    await expect(approvalSwitch).toBeVisible();

    // Should be unchecked (default false)
    await expect(approvalSwitch).not.toBeChecked();

    // Toggle on
    await approvalSwitch.click();
    await expect(page.getByText(/Godkännande krävs nu/i)).toBeVisible({ timeout: 5000 });

    // Toggle back off
    await approvalSwitch.click();
    await expect(page.getByText(/Ombokningar bekräftas direkt/i)).toBeVisible({ timeout: 5000 });
  });
});
