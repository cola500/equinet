import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Run tests serially to avoid race conditions with shared database
   * NOTE: This is a temporary workaround for MVP. Future improvements:
   * - Isolate test data per worker (different users/providers)
   * - Use database transactions with rollback
   * - Separate test databases per worker
   */
  workers: 1,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',

  /* Test timeout (60s per test) */
  timeout: 60000,

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Action timeout (default 10s -> 15s) */
    actionTimeout: 15000,

    /* Navigation timeout (default 30s -> 30s) */
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers */
  projects: [
    // Setup project that runs before all tests
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      testIgnore: /.*cleanup\.setup\.ts/, // Don't run cleanup in setup phase
    },
    // Main test project with dependency on setup
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'], // Run setup project before these tests
      teardown: 'cleanup', // Run cleanup after all chromium tests
    },
    // Cleanup project that runs after all tests
    {
      name: 'cleanup',
      testMatch: /.*cleanup\.setup\.ts/,
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 300000, // 5 minutes (first Turbopack build can be slow)
  },
});
