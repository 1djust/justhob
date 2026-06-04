# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: manager-notification.spec.ts >> Real-time Manager Notifications >> Manager receives lease expiry notification without page refresh
- Location: tests/e2e/manager-notification.spec.ts:25:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Welcome back,')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=Welcome back,')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - button "Toggle theme" [ref=e4]:
      - img [ref=e5]
      - generic [ref=e11]: Toggle theme
    - generic [ref=e12]:
      - generic [ref=e13]:
        - heading "Welcome back" [level=1] [ref=e14]
        - paragraph [ref=e15]: Enter your email to sign in to your account
      - generic [ref=e16]:
        - generic [ref=e17]:
          - text: Email
          - textbox "m@example.com" [ref=e18]: manager@justhob.com
        - generic [ref=e19]:
          - generic [ref=e20]:
            - generic [ref=e21]: Password
            - link "Forgot password?" [ref=e22] [cursor=pointer]:
              - /url: /forgot-password
          - generic [ref=e23]:
            - textbox [ref=e24]: Test1234!
            - button [ref=e25]:
              - img [ref=e26]
        - button "Sign In" [ref=e29]
        - generic [ref=e30]:
          - text: Don't have an account?
          - link "Sign up" [ref=e31] [cursor=pointer]:
            - /url: /register
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e37] [cursor=pointer]:
    - img [ref=e38]
  - alert [ref=e41]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { execSync } from 'child_process';
  3  | import path from 'path';
  4  | 
  5  | test.describe('Real-time Manager Notifications', () => {
  6  |   // Use a longer timeout because the DB setup script might take a while
  7  |   test.setTimeout(60000);
  8  | 
  9  |   test.beforeAll(async () => {
  10 |     // 1. Run the database setup script to set the lease to 30 days
  11 |     console.log('Running setup script (30 days)...');
  12 |     try {
  13 |       const rootDir = path.resolve(__dirname, '../../../../');
  14 |       execSync('npx tsx setup-mega-test.ts 30', {
  15 |         cwd: rootDir,
  16 |         stdio: 'inherit',
  17 |       });
  18 |       console.log('Setup script completed successfully.');
  19 |     } catch (error) {
  20 |       console.error('Failed to run setup script. The database might be unreachable.');
  21 |       throw error;
  22 |     }
  23 |   });
  24 | 
  25 |   test('Manager receives lease expiry notification without page refresh', async ({ page, request }) => {
  26 |     // 2. Login as the Property Manager
  27 |     await page.goto('/login');
  28 |     await page.fill('input[type="email"]', 'manager@justhob.com');
  29 |     await page.fill('input[type="password"]', 'Test1234!');
  30 |     await page.click('button[type="submit"]');
  31 | 
  32 |     // Wait for the dashboard to load completely
> 33 |     await expect(page.locator('text=Welcome back,')).toBeVisible();
     |                                                      ^ Error: expect(locator).toBeVisible() failed
  34 | 
  35 |     // Give the websocket a moment to connect and join the room
  36 |     await page.waitForTimeout(3000);
  37 | 
  38 |     // 3. Trigger the cron job via the API programmatically
  39 |     console.log('Triggering backend cron jobs...');
  40 |     const response = await request.post('http://localhost:3001/api/admin/trigger-crons', {
  41 |       data: {
  42 |         securityKey: 'JH-SAFE-2026-X',
  43 |       },
  44 |     });
  45 |     
  46 |     expect(response.ok()).toBeTruthy();
  47 |     const result = await response.json();
  48 |     console.log('Cron trigger result:', result);
  49 | 
  50 |     // 4. Verify that the UI updates IN REAL TIME without any refresh!
  51 |     console.log('Waiting for the red notification dot to appear...');
  52 |     
  53 |     // The red dot has the text representing the unread count
  54 |     const redDot = page.locator('span.absolute.bg-rose-500.text-white').first();
  55 |     
  56 |     // It should appear within 5 seconds without us triggering a page reload
  57 |     await expect(redDot).toBeVisible({ timeout: 10000 });
  58 |     
  59 |     // Click the bell to open the dropdown
  60 |     await page.locator('text=Notifications').first().click();
  61 | 
  62 |     // Verify the specific notification text is present
  63 |     const notificationTitle = page.locator('text=Tenant Lease Expiring').first();
  64 |     await expect(notificationTitle).toBeVisible();
  65 |     
  66 |     console.log('Test Passed! The manager received the notification instantly without a refresh.');
  67 |   });
  68 | });
  69 | 
```