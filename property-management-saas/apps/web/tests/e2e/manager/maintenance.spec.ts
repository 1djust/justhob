import { test, expect } from "../../fixtures";

/**
 * Manager - Maintenance tickets management tests.
 */
test.describe("Maintenance Management", () => {
  test.beforeEach(async ({ managerPage: page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /dashboard/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Navigate to Maintenance view
    await page.getByRole("button", { name: /maintenance/i }).click();
    await expect(
      page.getByRole("heading", { name: /maintenance plan/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("maintenance view loads with header and search input", async ({
    managerPage: page,
  }) => {
    // Header should be visible
    await expect(
      page.getByRole("heading", { name: /maintenance plan/i }),
    ).toBeVisible();

    // Search bar should be present
    const searchInput = page.getByPlaceholder(/search maintenance/i);
    await expect(searchInput).toBeVisible();
  });

  test("can filter maintenance by ticket status type", async ({
    managerPage: page,
  }) => {
    // Locate the status dropdown
    const typeSelect = page.locator("select").first();
    await expect(typeSelect).toBeVisible();

    // Filter by Pending
    await typeSelect.selectOption("PENDING");
    await expect(typeSelect).toHaveValue("PENDING");

    // Filter by Completed
    await typeSelect.selectOption("COMPLETED");
    await expect(typeSelect).toHaveValue("COMPLETED");

    // Reset to All
    await typeSelect.selectOption("");
    await expect(typeSelect).toHaveValue("");
  });
});
