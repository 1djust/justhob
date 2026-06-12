import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";

test.describe("Real-time Manager Notifications", () => {
  // Use a longer timeout because the DB setup script might take a while
  test.setTimeout(60000);

  test.beforeAll(async () => {
    // 1. Run the database setup script to set the lease to 30 days
    console.log("Running setup script (30 days)...");
    try {
      const rootDir = path.resolve(__dirname, "../../../../");
      execSync("npx tsx setup-mega-test.ts 30", {
        cwd: rootDir,
        stdio: "inherit",
      });
      console.log("Setup script completed successfully.");
    } catch (error) {
      console.error(
        "Failed to run setup script. The database might be unreachable.",
      );
      throw error;
    }
  });

  test("Manager receives lease expiry notification without page refresh", async ({
    page,
    request,
  }) => {
    // 2. Login as the Property Manager
    await page.goto("/login");
    await page.fill('input[type="email"]', "manager@justhob.com");
    await page.fill('input[type="password"]', "Test1234!");
    await page.click('button[type="submit"]');

    // Wait for the dashboard to load completely
    await expect(page.locator("text=Welcome back,")).toBeVisible({
      timeout: 15000,
    });

    // Give the websocket a moment to connect and join the room
    await page.waitForTimeout(3000);

    // 3. Trigger the cron job via the API programmatically
    console.log("Triggering backend cron jobs...");
    const response = await request.post(
      "http://localhost:3001/api/admin/trigger-crons",
      {
        data: {
          securityKey: "JH-SAFE-2026-X",
        },
      },
    );

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    console.log("Cron trigger result:", result);

    // 4. Verify that the UI updates IN REAL TIME without any refresh!
    console.log("Waiting for the red notification dot to appear...");

    // The red dot has the text representing the unread count
    const redDot = page.locator("span.absolute.bg-rose-500.text-white").first();

    // It should appear within 5 seconds without us triggering a page reload
    await expect(redDot).toBeVisible({ timeout: 10000 });

    // Click the bell to open the dropdown
    await page.locator("text=Notifications").first().click();

    // Verify the specific notification text is present
    const notificationTitle = page
      .locator("text=Tenant Lease Expiring")
      .first();
    await expect(notificationTitle).toBeVisible();

    console.log(
      "Test Passed! The manager received the notification instantly without a refresh.",
    );
  });
});
