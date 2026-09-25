import { test as base, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

/**
 * Reusable auth fixtures for PropertyStack E2E tests.
 *
 * Uses Playwright's storageState pattern: login once in the setup project,
 * save cookies/localStorage to a JSON file, then reuse across all tests.
 *
 * Usage:
 *   import { test, expect } from '../fixtures';
 *   test('my test', async ({ managerPage }) => { ... });
 */

// Paths to persisted auth state files
const AUTH_DIR = path.join(__dirname, "..", ".auth");
export const MANAGER_STATE_PATH = path.join(AUTH_DIR, "manager-state.json");
export const TENANT_STATE_PATH = path.join(AUTH_DIR, "tenant-state.json");

// Read credentials from environment (loaded from .env.test by playwright.config.ts)
function getCredentials(role: "manager" | "tenant"): {
  email: string;
  password: string;
} {
  if (role === "manager") {
    return {
      email: process.env.TEST_MANAGER_EMAIL || "manager_pro@justhob.com",
      password: process.env.TEST_MANAGER_PASSWORD || "Test1234!",
    };
  }
  return {
    email: process.env.TEST_TENANT_EMAIL || "pro-tenant@justhob.com",
    password: process.env.TEST_TENANT_PASSWORD || "Test1234!",
  };
}

/**
 * Perform a real Supabase login through the UI and save session state.
 * Called once by the "setup" project in playwright.config.ts.
 */
export async function loginAndSaveState(
  page: Page,
  role: "manager" | "tenant",
  savePath: string,
): Promise<void> {
  const { email, password } = getCredentials(role);

  await page.goto("/login");

  // Use resilient, user-centric locators
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|login|log in/i }).click();

  // Wait for successful redirect to dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page.locator("body")).not.toContainText("Invalid", {
    timeout: 5_000,
  });

  // Ensure the auth dir exists
  fs.mkdirSync(path.dirname(savePath), { recursive: true });

  // Save cookies + localStorage for reuse
  await page.context().storageState({ path: savePath });
}

/**
 * Extended test fixtures that provide pre-authenticated pages.
 *
 * - `managerPage`: a Page already logged in as a Property Manager
 * - `tenantPage`:  a Page already logged in as a Tenant
 *
 * These rely on storageState files created by the "setup" project.
 */
export const test = base.extend<{
  managerPage: Page;
  tenantPage: Page;
}>({
  managerPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: MANAGER_STATE_PATH,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  tenantPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: TENANT_STATE_PATH,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
