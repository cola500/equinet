import { test, expect } from './fixtures';
import { getBaseEntities } from './setup/seed-helpers';
import { generateUnsubscribeTokenForTest } from './setup/e2e-utils';
import { prisma } from './fixtures';

/**
 * E2E Tests for Email Unsubscribe
 *
 * Tests the /api/email/unsubscribe endpoint which returns HTML pages.
 * No login required -- uses HMAC token for verification.
 *
 * Tests:
 * 1. Valid HMAC link -> success page "Du har avregistrerad dig"
 * 2. Invalid token -> "Ogiltig eller utgången länk"
 * 3. Missing parameters -> "Ogiltig länk"
 * 4. Token without valid userId -> error message
 */

test.describe('Email Unsubscribe', () => {
  let userId: string;

  test.beforeAll(async () => {
    const base = await getBaseEntities();
    userId = base.customerId;
  });

  test.afterAll(async () => {
    // Restore emailRemindersEnabled to true for the test user
    await prisma.user.update({
      where: { email: 'test@example.com' },
      data: { emailRemindersEnabled: true },
    });
  });

  test('should unsubscribe with valid HMAC token', async ({ page }) => {
    const token = generateUnsubscribeTokenForTest(userId);

    await page.goto(`/api/email/unsubscribe?userId=${userId}&token=${token}`);

    // Success page should show
    await expect(page.getByText('Du har avregistrerad dig')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/bokningspåminnelser/i)).toBeVisible();

    // "Tillbaka till Equinet" link should be present
    await expect(page.getByRole('link', { name: /Tillbaka till Equinet/i })).toBeVisible();

    // Verify in DB that emailRemindersEnabled is now false
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailRemindersEnabled: true },
    });
    expect(user?.emailRemindersEnabled).toBe(false);
  });

  test('should show error for invalid token', async ({ page }) => {
    await page.goto(`/api/email/unsubscribe?userId=${userId}&token=invalid-token-12345`);

    // Error message
    await expect(page.getByText(/Ogiltig eller utgången länk/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show error for missing parameters', async ({ page }) => {
    // No userId, no token
    await page.goto('/api/email/unsubscribe');

    await expect(page.getByText(/Ogiltig länk/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show error for token without userId', async ({ page }) => {
    const token = generateUnsubscribeTokenForTest(userId);

    // Only token, no userId
    await page.goto(`/api/email/unsubscribe?token=${token}`);

    await expect(page.getByText(/Ogiltig länk/i)).toBeVisible({ timeout: 10000 });
  });
});
