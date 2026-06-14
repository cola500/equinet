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
// blocks headless browsers from datacenter IPs. When set, every request carries the
// `x-prod-smoke-bypass` header — pair it with a Vercel WAF *Custom Rule* that bypasses
// system mitigations (bypassSystem) for requests whose `x-prod-smoke-bypass` value
// matches this secret. (We use a dedicated header, NOT `x-vercel-protection-bypass`,
// which is reserved for Vercel Deployment Protection.) Without it the run fails at the
// checkpoint (confirmed locally 2026-06-13). No-op if unset.
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
      ? { extraHTTPHeaders: { 'x-prod-smoke-bypass': BYPASS_SECRET } }
      : {}),
  },
  projects: [
    { name: 'prod-smoke-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
