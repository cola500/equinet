import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',

  /* Run tests SERIALLY (not parallel) to ensure test isolation
   * CRITICAL: fullyParallel:false + workers:1 ensures:
   * - No race conditions with shared database
   * - Deterministic test execution order
   * - Clean UI state between tests (browser context resets)
   *
   * Sprint 2 F2-5: Test isolation strategy enforces serial execution
   */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Single worker ensures serial execution
   * Combined with fullyParallel:false for maximum isolation
   */
  workers: 1,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',

  /* Test timeout (60s per test, 120s in CI) */
  timeout: process.env.CI ? 120000 : 60000,

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

    /* Test isolation: Fresh browser context for each test
     * Sprint 2 F2-5: Playwright automatically creates a new BrowserContext
     * for each test, ensuring clean UI state (cookies, localStorage, sessionStorage).
     * Combined with serial execution (fullyParallel:false), this prevents state leakage.
     */
  },

  /* Configure projects for major browsers */
  projects: [
    // Setup project: seed E2E data before all tests
    {
      name: 'setup',
      testMatch: /seed-e2e\.setup\.ts/,
    },
    // Desktop (default)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      teardown: 'cleanup',
    },
    // Mobile viewport (Pixel 7: 412x915, Chromium-based)
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup'],
      teardown: 'cleanup',
    },
    // Cleanup project that runs after all tests
    {
      name: 'cleanup',
      testMatch: /.*cleanup\.setup\.ts/,
    },
    // Offline PWA testing (only when OFFLINE_E2E=true)
    // Runs only offline-pwa.spec.ts against production build on port 3001
    ...(process.env.OFFLINE_E2E === 'true'
      ? [
          {
            name: 'offline-chromium',
            testMatch: /offline-.*\.spec\.ts/,
            use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3001' },
          },
        ]
      : []),
  ],

  /* Run your local dev server before starting the tests.
   * When OFFLINE_E2E=true, also start a production build on port 3001. */
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 300000, // 5 minutes (first Turbopack build can be slow)
    },
    ...(process.env.OFFLINE_E2E === 'true'
      ? [
          {
            command: 'npm run build:pwa && npm run start:pwa',
            url: 'http://localhost:3001',
            reuseExistingServer: true,
            timeout: 300000,
          },
        ]
      : []),
  ],
});
