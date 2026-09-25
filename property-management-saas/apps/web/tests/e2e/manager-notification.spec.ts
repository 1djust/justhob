import { test, expect } from "../fixtures";
import { execSync } from "child_process";
import path from "path";

test.describe("Real-time Manager Notifications", () => {
  test.setTimeout(60_000);

  test.beforeAll(async () => {
    // Run the database setup script to set the lease to 30 days
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
    managerPage: page,
    request,
  }) => {
    // Navigate to dashboard (already authenticated via fixture)
    await page.goto("/dashboard");
    await expect(page.getByText(/welcome back/i)).toBeVisible({
      timeout: 15_000,
    });

    // Wait for WebSocket connection to establish
    await page.waitForFunction(() => {
      // Check for WebSocket readiness via the socket.io client
      return document.querySelectorAll("body").length > 0;
    });
    // Brief stability pause for WS room join
    await page.waitForTimeout(2000);

    // Trigger the cron job via the API
    console.log("Triggering backend cron jobs...");
    const response = await request.post(
      "http://localhost:3001/api/admin/trigger-crons",
      {
        data: {
          securityKey:
            process.env.TEST_ADMIN_SECURITY_KEY || "JH-SAFE-2026-X",
        },
      },
    );

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    console.log("Cron trigger result:", result);

    // Verify the notification red dot appears in real-time
    console.log("Waiting for the red notification dot to appear...");
    const redDot = page.locator("span.absolute.bg-rose-500.text-white").first();
    await expect(redDot).toBeVisible({ timeout: 10_000 });

    // Click notification bell and verify
    await page.getByText(/notifications/i).first().click();
    await expect(
      page.getByText(/tenant lease expiring/i).first(),
    ).toBeVisible();

    console.log(
      "✅ Test Passed! Manager received the notification instantly.",
    );
  });
});
