import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './apps/playground/e2e',
  timeout: 30_000,
  expect: {timeout: 10_000},
  retries: 0,
  maxFailures: process.env.CI ? 2 : undefined,
  workers: process.env.CI ? 2 : undefined,
  use: {baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure'},
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome']}},
    {name: 'mobile-chromium', use: {...devices['Pixel 7']}}],
  webServer: {
    command: 'npm run dev:lab -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
