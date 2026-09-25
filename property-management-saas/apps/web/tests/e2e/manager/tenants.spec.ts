import { test, expect } from "../../fixtures";

/**
 * Manager - Tenants management tests.
 */
test.describe("Tenants Management", () => {
  test.beforeEach(async ({ managerPage: page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /dashboard/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Navigate to Tenants view
    await page.getByRole("button", { name: /tenants/i }).click();
    await expect(
      page.getByRole("button", { name: /add tenant/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("tenants list loads with search input and action buttons", async ({
    managerPage: page,
  }) => {
    // Search input should be present
    const searchInput = page.getByPlaceholder(/search tenants/i);
    await expect(searchInput).toBeVisible();

    // Add Tenant button should be present
    const addTenantButton = page.getByRole("button", { name: /add tenant/i }).first();
    await expect(addTenantButton).toBeVisible();
  });

  test("can filter tenants using search input", async ({ managerPage: page }) => {
    const searchInput = page.getByPlaceholder(/search tenants/i);
    await expect(searchInput).toBeVisible();

    // Type a search query
    await searchInput.fill("Test");
    // Verify input value
    await expect(searchInput).toHaveValue("Test");

    // Clear search query
    await searchInput.clear();
    await expect(searchInput).toHaveValue("");
  });

  test("add tenant drawer / modal opens when clicking add button", async ({
    managerPage: page,
  }) => {
    const addTenantButton = page.getByRole("button", { name: /add tenant/i }).first();
    await addTenantButton.click();

    // Check for form fields in drawer/modal (e.g. name, email, phone)
    const nameOrEmailField = page.locator('input[name="name"], input[placeholder*="Name"], input[name="email"], input[placeholder*="Email"]').first();
    await expect(nameOrEmailField).toBeVisible({ timeout: 5_000 });
  });
});
