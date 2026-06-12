import { test, expect } from '@playwright/test';

test('test toggle responsiveness', async ({ page }) => {
  console.log("Navigating to login...");
  await page.goto('http://localhost:3000/login');
  
  await page.fill('input[type="email"]', 'manager_pro@justhob.com');
  await page.fill('input[type="password"]', 'Test1234!');
  await page.click('button[type="submit"]');

  console.log("Waiting for dashboard...");
  await page.waitForURL('**/dashboard**');

  console.log("Navigating to tenants list...");
  // The tenants list is actually on the main dashboard for the selected workspace!
  await page.goto('http://localhost:3000/dashboard');
  
  // Wait for the global toggle checkbox to appear
  console.log("Waiting for Global Toggle...");
  const globalToggle = page.locator('input[type="checkbox"]').first();
  await globalToggle.waitFor({ state: 'attached' });
  
  const isCheckedInitially = await globalToggle.isChecked();
  console.log(`Initial state: ${isCheckedInitially}`);

  console.log("Clicking toggle...");
  const startTime = Date.now();
  // Click the label or the checkbox wrapper
  await globalToggle.locator('..').click(); // click the relative wrapper label

  // Wait for the checkbox to change its visually checked state
  await expect(globalToggle).toBeChecked({ checked: !isCheckedInitially, timeout: 5000 });
  const endTime = Date.now();
  
  console.log(`Visual toggle took ${endTime - startTime}ms`);

  // Try again
  console.log("Clicking toggle again...");
  const startTime2 = Date.now();
  await globalToggle.locator('..').click();
  await expect(globalToggle).toBeChecked({ checked: isCheckedInitially, timeout: 5000 });
  const endTime2 = Date.now();

  console.log(`Second visual toggle took ${endTime2 - startTime2}ms`);
});
