import { defineConfig } from "@playwright/test";

/**
 * Admin E2E tests against a running server (dev or `next start`):
 *   E2E_BASE_URL=http://localhost:3000 npx playwright test
 * Uses the installed Google Chrome (no browser download). Global setup creates throwaway
 * admin / staff / customer users with the service role and deletes them afterwards.
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    navigationTimeout: 120_000,
    actionTimeout: 30_000,
    trace: "retain-on-failure",
  },
});
