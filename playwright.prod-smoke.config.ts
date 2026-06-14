import { defineConfig, devices } from '@playwright/test';

/**
 * Standalone Playwright config for the PRODUCTION smoke test.
 *
 * Runs against the LIVE site (no local webServer), triggered manually via the
 * `prod-smoke` GitHub workflow. Credentials come from env (GitHub Secrets).
 *
 * The spec `e2e/prod-smoke.spec.ts` is excluded from the normal suite via
 * `testIgnore` in playwright.config.ts, so it only runs through this config.
 */
const PROD_URL = process.env.PROD_SMOKE_URL || 'https://equinet.johanlindengard.com';

// Optional bypass for the Vercel Security Checkpoint (Attack Challenge Mode), which
// blocks headless browsers from datacenter IPs. When set, every request carries this
// header — pair it with a Vercel Firewall *bypass rule* that skips the challenge for
// requests presenting the matching `x-vercel-protection-bypass` value. Without it the
// run will fail at the checkpoint (confirmed locally 2026-06-13). No-op if unset.
const BYPASS_SECRET = process.env.PROD_SMOKE_BYPASS_SECRET;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/prod-smoke.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: PROD_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(BYPASS_SECRET
      ? {
          extraHTTPHeaders: {
            'x-vercel-protection-bypass': BYPASS_SECRET,
            'x-vercel-set-bypass-cookie': 'true',
          },
        }
      : {}),
  },
  projects: [
    { name: 'prod-smoke-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
