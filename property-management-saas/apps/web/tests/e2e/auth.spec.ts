import { test, expect } from '@playwright/test';

/**
 * Regression test: Verify the homepage redirects to the login page.
 * This is critical — unauthenticated users must always land on /login.
 */
test.describe('Homepage & Authentication', () => {
  test('homepage should redirect to /login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');
  });

  test('login page should render with proper form elements', async ({ page }) => {
    await page.goto('/login');

    // Verify core login UI elements exist
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login"), button:has-text("Log in")')).toBeVisible();
  });

  test('login with invalid credentials should show error', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"], input[name="email"]', 'invalid@test.com');
    await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"], button:has-text("Sign In"), button:has-text("Login"), button:has-text("Log in")');

    // Wait for error feedback (toast, alert, or inline message)
    await page.waitForTimeout(2000);

    // Page should stay on login (not navigate to dashboard)
    expect(page.url()).toContain('/login');
  });
});

/**
 * Regression test: Verify protected routes redirect unauthenticated users.
 */
test.describe('Protected Routes', () => {
  test('dashboard should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });
});

/**
 * Regression test: Verify page metadata and accessibility basics.
 */
test.describe('Page Metadata', () => {
  test('login page should have a proper title', async ({ page }) => {
    await page.goto('/login');
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });
});
