import { test, expect } from "../fixtures";

/**
 * E2E page load speed measurements.
 * Uses the auth fixture — no manual login needed.
 */
test("measure page load speeds as authenticated manager", async ({
  managerPage: page,
}) => {
  test.setTimeout(90_000);
  console.log("\n=============================================");
  console.log("=== End-to-End Page Load Speed Test ===");
  console.log("=============================================");

  // 1. Navigate to dashboard (already authenticated via fixture)
  const dashboardStart = Date.now();
  await page.goto("/dashboard");

  const dashboardHeading = page
    .getByRole("heading", { name: /dashboard/i })
    .first();
  await dashboardHeading.waitFor({ state: "attached" });
  const dashboardLoadTime = Date.now() - dashboardStart;
  console.log(`[E2E] Dashboard loaded in: ${dashboardLoadTime}ms`);

  // 2. Measure authenticated dashboard reload speed (Warmed state)
  console.log("[E2E] WARM RELOAD: Reloading dashboard page...");
  const reloadStart = Date.now();
  await page.reload();

  const reloadHeading = page
    .getByRole("heading", { name: /dashboard/i })
    .first();
  await reloadHeading.waitFor({ state: "attached" });
  const reloadTime = Date.now() - reloadStart;
  console.log(`[E2E] Dashboard reload speed: ${reloadTime}ms`);

  // 3. Measure screen transition speed (switching tabs)
  console.log("[E2E] Navigating to Properties tab...");
  const propertiesBtn = page.getByRole("button", { name: /properties/i });
  await propertiesBtn.waitFor({ state: "visible" });

  const propertiesStart = Date.now();
  await propertiesBtn.click();

  const propertiesContent = page
    .getByRole("button", { name: /add propert/i })
    .first();
  await propertiesContent.waitFor({ state: "attached" });
  const propertiesTransitionTime = Date.now() - propertiesStart;
  console.log(
    `[E2E] Dashboard -> Properties switch time: ${propertiesTransitionTime}ms`,
  );

  console.log("=============================================\n");
});
