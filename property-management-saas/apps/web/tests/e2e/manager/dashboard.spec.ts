import { test, expect } from "../../fixtures";

/**
 * Manager Dashboard — core navigation and overview tests.
 */
test.describe("Manager Dashboard", () => {
  test("dashboard loads with stats cards", async ({ managerPage: page }) => {
    await page.goto("/dashboard");

    // Dashboard heading should be visible
    await expect(
      page.getByRole("heading", { name: /dashboard/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // At least one stats card should render (properties, tenants, etc.)
    const statsContainer = page.locator('[class*="grid"]').first();
    await expect(statsContainer).toBeVisible();
  });

  test("sidebar navigation switches between views", async ({
    managerPage: page,
  }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /dashboard/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Navigate to Properties
    await page.getByRole("button", { name: /properties/i }).click();
    await expect(
      page.getByRole("button", { name: /add propert/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Navigate to Tenants
    await page.getByRole("button", { name: /tenants/i }).click();
    await expect(
      page.getByRole("button", { name: /add tenant/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Navigate to Payments
    await page.getByRole("button", { name: /payments/i }).click();
    // Payments view should show some content
    await expect(page.getByText(/payment/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to Maintenance
    await page.getByRole("button", { name: /maintenance/i }).click();
    await expect(page.getByText(/maintenance/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // Navigate back to Dashboard
    await page.getByRole("button", { name: /dashboard/i }).first().click();
    await expect(
      page.getByRole("heading", { name: /dashboard/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("logout redirects to login", async ({ managerPage: page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /dashboard/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Click logout button
    const logoutButton = page.getByRole("button", { name: /log\s?out|sign\s?out/i });
    await logoutButton.click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
