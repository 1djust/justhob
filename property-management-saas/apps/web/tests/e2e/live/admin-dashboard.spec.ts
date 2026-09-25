import { test, expect } from "@playwright/test";

/**
 * Super Admin E2E Test — runs against the LIVE production deployment.
 * Use with: npx playwright test --config=playwright.live.config.ts
 *
 * This test is excluded from local runs via testIgnore in the main config.
 */
test.describe("Super Admin End-to-End Test", () => {
  test("Should login and navigate manager hierarchy successfully", async ({
    page,
  }) => {
    const adminEmail = process.env.TEST_ADMIN_EMAIL || "admin@justhob.com";
    const adminPassword = process.env.TEST_ADMIN_PASSWORD || "Test1234!";
    const securityKey =
      process.env.TEST_ADMIN_SECURITY_KEY ||
      "8d5e1b2f7a9c3d4e0f8b7a6c5d4e2f1a";

    await page.goto("https://propertystack.vercel.app/admin/login");

    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    const loginButton = page.getByRole("button", {
      name: /authentication|sign in/i,
    });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Step 1: Login
    await emailInput.fill(adminEmail);
    await passwordInput.fill(adminPassword);
    await loginButton.click();

    // Step 2: 2FA Security Key
    const securityKeyInput = page.getByPlaceholder("JH-SAFE-XXXX-X");
    await expect(securityKeyInput).toBeVisible({ timeout: 10_000 });
    await securityKeyInput.fill(securityKey);

    const verifyButton = page.getByRole("button", {
      name: /unlock system/i,
    });
    await verifyButton.click();

    // Verify dashboard loaded
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /super admin console/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Open User Registry Tab
    const usersTabLink = page.getByRole("button", { name: /users/i });
    await expect(usersTabLink).toBeVisible();
    await usersTabLink.click();

    // Wait for users registry
    const userSearchInput = page.getByPlaceholder(/search by name or email/i);
    await expect(userSearchInput).toBeVisible({ timeout: 10_000 });

    // Find "Solomon Ruth" and click Hierarchy
    const managerCard = page.locator("div", { hasText: "Solomon Ruth" });
    await expect(managerCard).toBeVisible();

    const hierarchyButton = managerCard.getByRole("button", {
      name: /hierarchy/i,
    });
    await expect(hierarchyButton).toBeVisible();
    await hierarchyButton.click();

    // Verify Landlord list
    const landlordHeader = page.getByRole("heading", {
      name: /test landlord/i,
    });
    await expect(landlordHeader).toBeVisible({ timeout: 10_000 });
    await landlordHeader.click();

    // Verify tenant visible
    await expect(page.getByText("Olawole John")).toBeVisible({
      timeout: 10_000,
    });

    await page.screenshot({
      path: "test-results/admin-dashboard-e2e-success.png",
      fullPage: true,
    });
  });
});
