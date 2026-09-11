// playwright.config.js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/Browser',
  use: {
    baseURL: 'https://ikram-system.onrender.com',
    headless: true,
    screenshot: 'only-on-failure',
    navigationTimeout: 60000,
    actionTimeout: 30000,
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
  timeout: 120000,
  retries: 0,
  workers: 1,
});
