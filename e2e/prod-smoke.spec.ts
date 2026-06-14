import { test, expect, type Page } from '@playwright/test';

/**
 * PRODUCTION smoke test — runs ONLY via `playwright.prod-smoke.config.ts`
 * (manual `prod-smoke` workflow) against the live site. Excluded from the
 * normal E2E suite via `testIgnore` in playwright.config.ts.
 *
 * Verifies, after the feature-flag source-of-truth migration + Edge Config
 * retirement, that production still works:
 *  - /api/feature-flags = 200, follow_provider=true, municipality_watch=true
 *  - provider login -> /provider/calendar renders without 5xx
 *  - customer login -> /hem renders without 5xx
 *
 * Credentials come from env (GitHub Secrets). Passwords are never logged.
 *
 * NOTE: production sits behind the Vercel Security Checkpoint (a JS bot-challenge).
 * A real browser engine passes it automatically; we wait for the real page title.
 * Datacenter IPs (GitHub-hosted runners) MAY be challenged harder — see the
 * workflow file for the fallback if the checkpoint blocks CI.
 */

const PROVIDER_EMAIL = process.env.PROD_SMOKE_PROVIDER_EMAIL ?? '';
const PROVIDER_PASSWORD = process.env.PROD_SMOKE_PROVIDER_PASSWORD ?? '';
const CUSTOMER_EMAIL = process.env.PROD_SMOKE_CUSTOMER_EMAIL ?? '';
const CUSTOMER_PASSWORD = process.env.PROD_SMOKE_CUSTOMER_PASSWORD ?? '';

// Fail fast with a clear message if secrets are missing — never print values.
test.beforeAll(() => {
  const missing = (
    [
      ['PROD_SMOKE_PROVIDER_EMAIL', PROVIDER_EMAIL],
      ['PROD_SMOKE_PROVIDER_PASSWORD', PROVIDER_PASSWORD],
      ['PROD_SMOKE_CUSTOMER_EMAIL', CUSTOMER_EMAIL],
      ['PROD_SMOKE_CUSTOMER_PASSWORD', CUSTOMER_PASSWORD],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Saknar GitHub Secrets: ${missing.join(', ')}`);
  }
});

async function dismissCookieNotice(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('equinet-cookie-notice-dismissed', 'true');
  });
}

/** Wait for the Vercel Security Checkpoint JS-challenge to resolve. */
async function waitPastCheckpoint(page: Page) {
  await expect(page).not.toHaveTitle(/Security Checkpoint/i, { timeout: 30_000 });
}

/** Collect any 5xx responses seen on the page (manifest 429 etc. are ignored). */
function track5xx(page: Page): number[] {
  const errors: number[] = [];
  page.on('response', (res) => {
    if (res.status() >= 500) errors.push(res.status());
  });
  return errors;
}

async function login(page: Page, email: string, password: string) {
  await dismissCookieNotice(page);
  await page.goto('/login');
  await waitPastCheckpoint(page);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel('Lösenord', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Logga in' }).click();
}

test.describe('Production smoke', () => {
  test('feature-flags API returns 200 with expected source-of-truth values', async ({ page }) => {
    await dismissCookieNotice(page);
    await page.goto('/login');
    await waitPastCheckpoint(page);

    // Fetch from the page context so the request also clears the checkpoint
    // (a raw request context is blocked with 429 by the checkpoint).
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/feature-flags');
      const json = await res.json();
      const flags = json.flags || json;
      return {
        status: res.status,
        follow_provider: flags.follow_provider,
        municipality_watch: flags.municipality_watch,
      };
    });

    expect(result.status).toBe(200);
    expect(result.follow_provider).toBe(true);
    expect(result.municipality_watch).toBe(true);
  });

  test('provider login lands on /provider/calendar and renders', async ({ page }) => {
    const errors = track5xx(page);

    await login(page, PROVIDER_EMAIL, PROVIDER_PASSWORD);
    await page.waitForURL('**/provider/calendar', { timeout: 30_000 });

    await expect(page.getByRole('heading', { name: 'Kalender', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Kalender' })).toBeVisible();
    expect(errors, `5xx-svar under provider-flödet: ${errors.join(',')}`).toHaveLength(0);
  });

  test('customer login lands on /hem and renders', async ({ page }) => {
    const errors = track5xx(page);

    await login(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.waitForURL('**/hem', { timeout: 30_000 });

    await expect(page.locator('main').first()).toBeVisible();
    expect(errors, `5xx-svar under kund-flödet: ${errors.join(',')}`).toHaveLength(0);
  });
});
