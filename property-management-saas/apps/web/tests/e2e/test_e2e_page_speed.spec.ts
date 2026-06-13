import { test, expect } from '@playwright/test';

test('measure page load speeds as manager_pro', async ({ page }) => {
  test.setTimeout(90000);
  console.log("\n=============================================");
  console.log("=== End-to-End Page Load Speed Test ===");
  console.log("=============================================");

  // 1. Measure Login Page Load
  const loginStart = Date.now();
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('input[type="email"]');
  const loginLoadTime = Date.now() - loginStart;
  console.log(`[E2E] Login page loaded in: ${loginLoadTime}ms`);

  // 2. Perform Login & Measure Redirect + Dashboard Mount
  await page.fill('input[type="email"]', 'manager_pro@justhob.com');
  await page.fill('input[type="password"]', 'Test1234!');
  
  const submitStart = Date.now();
  await page.click('button[type="submit"]');
  
  console.log("[E2E] Logging in, waiting for redirect to dashboard...");
  await page.waitForURL('**/dashboard**');
  
  // Wait for the Dashboard heading to render
  const dashboardHeading = page.locator('h2:has-text("Dashboard"), h3:has-text("Dashboard")').first();
  await dashboardHeading.waitFor({ state: 'attached' });
  const dashboardLoadTime = Date.now() - submitStart;
  console.log(`[E2E] Login submit -> Dashboard fully loaded in: ${dashboardLoadTime}ms`);

  // 3. Measure authenticated dashboard reload speed (Warmed state)
  console.log("[E2E] WARM RELOAD: Reloading dashboard page...");
  const reloadStart = Date.now();
  await page.reload();
  const reloadHeading = page.locator('h2:has-text("Dashboard"), h3:has-text("Dashboard")').first();
  await reloadHeading.waitFor({ state: 'attached' });
  const reloadTime = Date.now() - reloadStart;
  console.log(`[E2E] Dashboard reload speed: ${reloadTime}ms`);

  // 4. Measure screen transition speed (switching tabs)
  console.log("[E2E] Navigating to Properties tab...");
  const propertiesBtn = page.locator('button:has-text("Properties")');
  await propertiesBtn.waitFor({ state: 'visible' });
  
  const propertiesStart = Date.now();
  await propertiesBtn.click();
  
  // Wait for properties content (e.g., 'Add Properties' button)
  const propertiesContent = page.locator('button:has-text("Add Properties")').first();
  await propertiesContent.waitFor({ state: 'attached' });
  const propertiesTransitionTime = Date.now() - propertiesStart;
  console.log(`[E2E] Dashboard -> Properties switch time: ${propertiesTransitionTime}ms`);

  await page.waitForTimeout(1000);
  console.log("=============================================\n");
});
