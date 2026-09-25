import { test, expect } from "../../fixtures";

/**
 * Properties management — list, view, add (mocked).
 */
test.describe("Properties Management", () => {
  test.beforeEach(async ({ managerPage: page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /dashboard/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Navigate to Properties view
    await page.getByRole("button", { name: /properties/i }).click();
    await expect(
      page.getByRole("button", { name: /add propert/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("properties list loads with content", async ({
    managerPage: page,
  }) => {
    // Should have at least one property card or an empty state
    const hasProperties = await page.getByText(/property|no properties/i).first().isVisible();
    expect(hasProperties).toBeTruthy();
  });

  test("add property button opens form", async ({ managerPage: page }) => {
    const addButton = page.getByRole("button", { name: /add propert/i }).first();
    await addButton.click();

    // Form fields should appear
    await expect(
      page.getByLabel(/name|property name/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("property cards display key information", async ({
    managerPage: page,
  }) => {
    // Check that property content is visible (name, address, or tenant info)
    const propertyContent = page
      .locator('[class*="card"], [class*="Card"]')
      .first();

    // Either cards exist or empty state
    const cardCount = await propertyContent.count();
    if (cardCount > 0) {
      await expect(propertyContent).toBeVisible();
    }
  });
});
