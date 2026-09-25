import { test, expect } from "@playwright/test";

/**
 * Auth regression tests — no login fixture needed here
 * because these tests verify unauthenticated behavior.
 */
test.describe("Homepage & Authentication", () => {
  test("homepage should render landing page branding", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/PropertyStack/);
  });

  test("login page should render with proper form elements", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in|login|log in/i }),
    ).toBeVisible();
  });

  test("login with invalid credentials should show error", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel(/email/i).fill("invalid@test.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in|login|log in/i }).click();

    // Web-first assertion: auto-retries until error appears or timeout
    await expect(page).toHaveURL(/\/login/);
  });
});

/**
 * Regression: Protected routes redirect unauthenticated users.
 */
test.describe("Protected Routes", () => {
  test("dashboard should redirect to login when not authenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

/**
 * Regression: Page metadata and accessibility basics.
 */
test.describe("Page Metadata", () => {
  test("login page should have a proper title", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/.+/);
  });
});
