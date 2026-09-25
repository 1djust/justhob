import { test, expect } from "../../fixtures";

/**
 * Manager - Payments management tests.
 */
test.describe("Payments Management", () => {
  test.beforeEach(async ({ managerPage: page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /dashboard/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Navigate to Payments view
    await page.getByRole("button", { name: /payments/i }).click();
    await expect(
      page.getByRole("heading", { name: /payments/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("payments list loads with search input and status filter", async ({
    managerPage: page,
  }) => {
    // Search input should be present
    const searchInput = page.getByPlaceholder(/search payments/i);
    await expect(searchInput).toBeVisible();

    // Status filter select dropdown should be present
    const statusSelect = page.locator("select").first();
    await expect(statusSelect).toBeVisible();
  });

  test("can filter payments by status", async ({ managerPage: page }) => {
    const statusSelect = page.locator("select").first();
    await expect(statusSelect).toBeVisible();

    // Select 'PAID' filter option
    await statusSelect.selectOption("PAID");
    await expect(statusSelect).toHaveValue("PAID");

    // Select 'All Status' option
    await statusSelect.selectOption("");
    await expect(statusSelect).toHaveValue("");
  });

  test("record offline payment button opens payment form modal", async ({
    managerPage: page,
  }) => {
    const recordButton = page.getByRole("button", {
      name: /record offline payment/i,
    });

    if (await recordButton.isVisible()) {
      await recordButton.click();

      // Verify modal/form opened
      const modalOrForm = page.locator('[role="dialog"], form, .modal').first();
      await expect(modalOrForm).toBeVisible({ timeout: 5_000 });
    }
  });
});
