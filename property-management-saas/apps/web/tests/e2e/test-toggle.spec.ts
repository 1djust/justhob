import { test, expect } from "../fixtures";

/**
 * Tests toggle responsiveness for the global tenant toggle.
 * Uses the auth fixture — no manual login needed.
 */
test("test toggle responsiveness", async ({ managerPage: page }) => {
  await page.goto("/dashboard");

  // Wait for the global toggle checkbox to appear
  const globalToggle = page.locator('input[type="checkbox"]').first();
  await globalToggle.waitFor({ state: "attached" });

  const isCheckedInitially = await globalToggle.isChecked();

  // Click the toggle wrapper
  const startTime = Date.now();
  await globalToggle.locator("..").click();

  await expect(globalToggle).toBeChecked({
    checked: !isCheckedInitially,
    timeout: 5000,
  });
  const toggleTime = Date.now() - startTime;
  console.log(`Visual toggle took ${toggleTime}ms`);

  // Toggle back
  const startTime2 = Date.now();
  await globalToggle.locator("..").click();
  await expect(globalToggle).toBeChecked({
    checked: isCheckedInitially,
    timeout: 5000,
  });
  const toggleTime2 = Date.now() - startTime2;
  console.log(`Second visual toggle took ${toggleTime2}ms`);
});
