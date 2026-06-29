import { test, expect } from "@playwright/test";

test.describe("Super Admin End-to-End Test", () => {
  test("Should login and navigate manager hierarchy successfully", async ({
    page,
  }) => {
    // Navigate to the login page of the production app
    await page.goto("https://propertystack.vercel.app/admin/login");

    // Expecting to see the login form fields
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator(
      'input[type="password"], input[name="password"]',
    );
    const loginButton = page.locator(
      'button[type="submit"], button:has-text("Authentication"), button:has-text("Sign In")',
    );

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Perform Step 1: Login
    await emailInput.fill("admin@justhob.com");
    await passwordInput.fill("Test1234!");
    await loginButton.click();

    // Verify that the login form transitions to Step 2: 2FA Security Key
    const securityKeyInput = page.locator(
      'input[placeholder="JH-SAFE-XXXX-X"]',
    );
    await expect(securityKeyInput).toBeVisible({ timeout: 10000 });

    // Fill the 2FA key
    await securityKeyInput.fill("8d5e1b2f7a9c3d4e0f8b7a6c5d4e2f1a");

    // Find the verification submit button and click it
    const verifyButton = page.locator('button:has-text("Unlock System")');
    await verifyButton.click();

    // Wait for the URL to change to dashboard
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    expect(page.url()).toContain("/dashboard");

    // Check if stats dashboard console header is visible
    const consoleHeader = page.locator('h2:has-text("Super Admin Console")');
    await expect(consoleHeader).toBeVisible({ timeout: 15000 });

    // Listen to network responses for debugging
    page.on("response", async (response) => {
      if (response.url().includes("/api/super-admin/users")) {
        console.log(
          ">> API Response for users:",
          response.status(),
          await response.text(),
        );
      }
    });

    // Open User Registry Tab
    const usersTabLink = page.locator('aside button:has-text("Users")');
    await expect(usersTabLink).toBeVisible();
    await usersTabLink.click();

    // Wait for users registry to load
    const userSearchInput = page.locator(
      'input[placeholder*="Search by name or email"]',
    );
    await expect(userSearchInput).toBeVisible({ timeout: 10000 });

    // Find the Property Manager "Solomon Ruth" and click on the "Hierarchy" button
    const managerCard = page.locator("div", { hasText: "Solomon Ruth" });
    await expect(managerCard).toBeVisible();

    const hierarchyButton = managerCard.locator('button:has-text("Hierarchy")');
    await expect(hierarchyButton).toBeVisible();
    await hierarchyButton.click();

    // Wait for the Landlord list to load inside the hierarchy section
    const landlordHeader = page.locator(
      'h5:has-text("Landlord: Test Landlord"), h5:has-text("Test Landlord")',
    );
    await expect(landlordHeader).toBeVisible({ timeout: 10000 });

    // Expand the Landlord card to view Tenants
    await landlordHeader.click();

    // Verify that the tenant "Olawole John" is visible under the Landlord
    const tenantName = page.locator('span:has-text("Olawole John")');
    await expect(tenantName).toBeVisible({ timeout: 10000 });

    // Take screenshot of final expanded hierarchy
    await page.screenshot({
      path: "test-results/admin-dashboard-e2e-success.png",
      fullPage: true,
    });
  });
});
