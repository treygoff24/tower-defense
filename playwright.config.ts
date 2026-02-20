import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,       // Serial — we share one server instance
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start both client (Vite) and server (Express+Socket.IO) before tests
  webServer: [
    {
      command: 'pnpm --filter @td/server dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command: 'pnpm --filter @td/client dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
  ],
});
