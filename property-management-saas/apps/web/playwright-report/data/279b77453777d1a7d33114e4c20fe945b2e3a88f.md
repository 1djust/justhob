# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-toggle.spec.ts >> test toggle responsiveness
- Location: tests/e2e/test-toggle.spec.ts:3:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.waitFor: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[type="checkbox"]').first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary "Sidebar Navigation" [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - img "PropertyStack Logo" [ref=e6]
          - generic [ref=e7]: PropertyStack
        - button "Collapse" [ref=e9]:
          - img [ref=e10]
      - navigation [ref=e12]:
        - button "Dashboard" [ref=e13]:
          - img [ref=e14]
          - generic [ref=e19]: Dashboard
        - button "Properties" [ref=e21]:
          - img [ref=e22]
          - generic [ref=e26]: Properties
        - button "Tenants" [ref=e27]:
          - img [ref=e28]
          - generic [ref=e33]: Tenants
        - button "Owners" [ref=e34]:
          - img [ref=e35]
          - generic [ref=e39]: Owners
        - button "Payments" [ref=e40]:
          - img [ref=e41]
          - generic [ref=e43]: Payments
        - button "Occupancy" [ref=e44]:
          - img [ref=e45]
          - generic [ref=e47]: Occupancy
        - button "Maintenance" [ref=e48]:
          - img [ref=e49]
          - generic [ref=e51]: Maintenance
        - button "Settings" [ref=e52]:
          - img [ref=e53]
          - generic [ref=e56]: Settings
        - button "Notifications" [ref=e58]:
          - img [ref=e60]
          - generic [ref=e63]: Notifications
      - generic [ref=e64]:
        - generic [ref=e65]:
          - generic [ref=e66]:
            - paragraph [ref=e67]: Profile
            - generic [ref=e68]: PRO
          - paragraph [ref=e69]: manager_pro@justhob.com
        - generic [ref=e70]:
          - generic [ref=e71]:
            - button "Toggle theme" [ref=e72]:
              - img [ref=e73]
              - generic [ref=e79]: Toggle theme
            - generic [ref=e80]: Appearance
          - button "Sign out" [ref=e81]:
            - img [ref=e82]
            - generic [ref=e85]: Sign out
    - main [ref=e86]:
      - generic [ref=e88]:
        - heading "Dashboard" [level=2] [ref=e90]
        - generic [ref=e97]:
          - generic [ref=e99]:
            - heading "Active Workspaces" [level=3] [ref=e100]
            - paragraph [ref=e101]: Manage your team and roles
          - generic [ref=e103]:
            - generic [ref=e104] [cursor=pointer]:
              - generic [ref=e105]:
                - img [ref=e107]
                - generic [ref=e110]: PROPERTY MANAGER
              - heading "Pro Property Management" [level=4] [ref=e111]
              - generic [ref=e112]:
                - generic [ref=e113]: Full Access
                - img [ref=e114]
            - generic [ref=e117] [cursor=pointer]:
              - generic [ref=e118]:
                - img [ref=e120]
                - generic [ref=e123]: PROPERTY MANAGER
              - heading "Pro Property Management" [level=4] [ref=e124]
              - generic [ref=e126]: Full Access
  - region "Notifications alt+T"
  - generic [ref=e127]:
    - img [ref=e129]
    - button "Open Tanstack query devtools" [ref=e177] [cursor=pointer]:
      - img [ref=e178]
  - button "Open Next.js Dev Tools" [ref=e231] [cursor=pointer]:
    - img [ref=e232]
  - alert [ref=e235]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('test toggle responsiveness', async ({ page }) => {
  4  |   console.log("Navigating to login...");
  5  |   await page.goto('http://localhost:3000/login');
  6  |   
  7  |   await page.fill('input[type="email"]', 'manager_pro@justhob.com');
  8  |   await page.fill('input[type="password"]', 'Test1234!');
  9  |   await page.click('button[type="submit"]');
  10 | 
  11 |   console.log("Waiting for dashboard...");
  12 |   await page.waitForURL('**/dashboard**');
  13 | 
  14 |   console.log("Navigating to tenants list...");
  15 |   // The tenants list is actually on the main dashboard for the selected workspace!
  16 |   await page.goto('http://localhost:3000/dashboard');
  17 |   
  18 |   // Wait for the global toggle checkbox to appear
  19 |   console.log("Waiting for Global Toggle...");
  20 |   const globalToggle = page.locator('input[type="checkbox"]').first();
> 21 |   await globalToggle.waitFor({ state: 'attached' });
     |                      ^ Error: locator.waitFor: Test timeout of 30000ms exceeded.
  22 |   
  23 |   const isCheckedInitially = await globalToggle.isChecked();
  24 |   console.log(`Initial state: ${isCheckedInitially}`);
  25 | 
  26 |   console.log("Clicking toggle...");
  27 |   const startTime = Date.now();
  28 |   // Click the label or the checkbox wrapper
  29 |   await globalToggle.locator('..').click(); // click the relative wrapper label
  30 | 
  31 |   // Wait for the checkbox to change its visually checked state
  32 |   await expect(globalToggle).toBeChecked({ checked: !isCheckedInitially, timeout: 5000 });
  33 |   const endTime = Date.now();
  34 |   
  35 |   console.log(`Visual toggle took ${endTime - startTime}ms`);
  36 | 
  37 |   // Try again
  38 |   console.log("Clicking toggle again...");
  39 |   const startTime2 = Date.now();
  40 |   await globalToggle.locator('..').click();
  41 |   await expect(globalToggle).toBeChecked({ checked: isCheckedInitially, timeout: 5000 });
  42 |   const endTime2 = Date.now();
  43 | 
  44 |   console.log(`Second visual toggle took ${endTime2 - startTime2}ms`);
  45 | });
  46 | 
```