import { defineConfig, devices } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

// Load test credentials from .env.test
dotenv.config({ path: path.resolve(__dirname, ".env.test") });

const MANAGER_STATE = path.join(__dirname, "tests", ".auth", "manager-state.json");
const TENANT_STATE = path.join(__dirname, "tests", ".auth", "tenant-state.json");

/**
 * Playwright E2E test configuration for the Property Management Web Dashboard.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests/e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use */
  reporter: [["html", { open: "never" }], ["list"]],
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    /* Collect trace when retrying the failed test */
    trace: "on-first-retry",
    /* Capture screenshot on failure */
    screenshot: "only-on-failure",
    /* Record video on first retry for better debugging */
    video: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    // --- Auth Setup (runs first, logs in and saves session state) ---
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },

    // --- Main test suites (depend on setup) ---
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: MANAGER_STATE,
      },
      dependencies: ["setup"],
      testIgnore: /live\//,
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: MANAGER_STATE,
      },
      dependencies: ["setup"],
      testIgnore: /live\//,
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        storageState: MANAGER_STATE,
      },
      dependencies: ["setup"],
      testIgnore: /live\//,
    },

    // --- Mobile & Android Emulator Projects ---
    {
      name: "android-emulator",
      use: {
        ...devices["Pixel 7"],
        storageState: MANAGER_STATE,
      },
      dependencies: ["setup"],
      testIgnore: /live\//,
    },
    {
      name: "mobile-safari",
      use: {
        ...devices["iPhone 14"],
        storageState: MANAGER_STATE,
      },
      dependencies: ["setup"],
      testIgnore: /live\//,
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
