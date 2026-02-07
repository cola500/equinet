import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  timeout: 60000,
  use: { 
    baseURL: 'http://localhost:3000',
    ...devices['Desktop Chrome'],
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    { name: 'setup', testMatch: /seed-e2e\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      teardown: 'cleanup',
    },
    { name: 'cleanup', testMatch: /.*cleanup\.setup\.ts/ },
  ],
});
