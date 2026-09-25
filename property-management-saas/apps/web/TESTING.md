# 🎭 Playwright E2E Testing Guide — PropertyStack

This document outlines the testing architecture, environment configuration, command reference, and best practices for writing and maintaining End-to-End (E2E) tests in `apps/web`.

---

## 1. Overview & Architecture

The E2E suite uses **Microsoft Playwright** configured with:
- **Authentication State Caching (`storageState`)**: Logs in once before tests via `auth.setup.ts` and reuses sessions across tests, saving significant execution time.
- **Cross-Browser Projects**: Chromium (Chrome/Edge), Firefox, and WebKit (Safari).
- **Reusable Fixtures**: `managerPage` (pre-authenticated manager), `tenantPage` (pre-authenticated tenant), and `mockApi` (network interception).
- **Dynamic & Mocked Coverage**: Combines live interaction with route mocking for resilient UI verification.

---

## 2. Environment Setup

### 2.1 Test Environment File (`.env.test`)
Copy the template to create your local test environment:
```bash
cd apps/web
cp .env.test.example .env.test
```

The `.env.test` file is loaded automatically by `playwright.config.ts`.

### 2.2 Default Test Credentials Reference
The database comes seeded with standard test accounts (from `test-users.json`):

| Role | Email | Password | Description |
| :--- | :--- | :--- | :--- |
| **Manager (Pro)** | `manager_pro@justhob.com` | `Test1234!` | Pro workspace manager |
| **Manager** | `manager@justhob.com` | `Test1234!` | Standard property manager |
| **Tenant** | `pro-tenant@justhob.com` | `Test1234!` | Tenant attached to Pro workspace |
| **Super Admin** | `admin@justhob.com` | `Test1234!` | Global system administrator |

---

## 3. Command Reference

All commands are run from `apps/web` (or prefixed with `pnpm --filter web <command>` from the root).

### 3.1 Standard Test Execution
```bash
# Run all tests across desktop & mobile
pnpm test

# Run tests in Chromium only (fastest developer iteration loop)
pnpm test:chromium

# Run tests against Android Emulator profile (Pixel 7 specs matching emulator-5554)
pnpm test:android

# Run all mobile profiles (Android + Mobile Safari)
pnpm test:mobile
```

### 3.2 Visual & Interactive Debugging
```bash
# Interactive UI Mode (Playwright test runner UI with time-travel & DOM tree)
pnpm test:ui

# Headed mode (opens physical browser windows)
pnpm test:headed

# Playwright Debugger (step-by-step inspector with breakpoints)
pnpm test:debug
```

### 3.3 Viewing Reports & Traces
```bash
# Open the latest HTML test report
pnpm test:report

# Inspect a specific trace file
npx playwright show-trace test-results/<test-dir>/trace.zip
```

### 3.4 Running Against Live Production
```bash
# Runs live smoke tests against propertystack.vercel.app
pnpm test:live
```

---

## 4. Running Targeted Tests

You can filter test execution by file path, folder, or test title:

```bash
# Run a specific test file
npx playwright test tests/e2e/manager/properties.spec.ts

# Run all manager flow tests
npx playwright test tests/e2e/manager/

# Run all tenant flow tests
npx playwright test tests/e2e/tenant/

# Run tests matching a specific name pattern (-g / --grep)
npx playwright test -g "toggle responsiveness"
npx playwright test -g "sidebar navigation"
```

---

## 5. Test Suite Directory Structure

```text
apps/web/tests/
├── .auth/                        # Auto-generated auth session states (gitignored)
│   ├── manager-state.json
│   └── tenant-state.json
├── fixtures/                     # Shared test fixtures & helpers
│   ├── index.ts                  # Unified barrel export
│   ├── auth.fixture.ts           # managerPage & tenantPage fixtures
│   └── api.fixture.ts            # mockApi & network helpers
└── e2e/
    ├── auth.setup.ts             # Setup project: performs initial logins
    ├── auth.spec.ts              # Login & unauthenticated redirect tests
    ├── test-toggle.spec.ts       # Global toggle responsiveness
    ├── test_e2e_page_speed.spec.ts# Performance & page load metrics
    ├── manager-notification.spec.ts# Real-time WebSocket notifications
    ├── live/
    │   └── admin-dashboard.spec.ts# Production live verification
    ├── manager/                  # Manager dashboard feature tests
    │   ├── dashboard.spec.ts     # Stats & sidebar navigation
    │   ├── properties.spec.ts    # Properties list & add form
    │   ├── tenants.spec.ts       # Tenants registry & search
    │   ├── payments.spec.ts      # Payments & offline recording
    │   └── maintenance.spec.ts   # Maintenance plan & ticket filters
    └── tenant/                   # Tenant portal tests
        └── portal.spec.ts        # Portal rendering, maintenance form, 404
```

---

## 6. How to Write New Tests

### 6.1 Writing Authenticated Manager Tests
Import `test` and `expect` from `../fixtures` (or relative path) and use the `managerPage` fixture:

```typescript
import { test, expect } from "../fixtures";

test.describe("Feature Name", () => {
  test("should display data correctly", async ({ managerPage: page }) => {
    // Automatically authenticated — no manual login required
    await page.goto("/dashboard");
    
    // Use user-centric locators
    await page.getByRole("button", { name: /properties/i }).click();
    await expect(page.getByRole("heading", { name: /properties/i })).toBeVisible();
  });
});
```

### 6.2 Writing Tenant Portal Tests with Route Mocking
Use Playwright's route interception for deterministic API testing:

```typescript
import { test, expect } from "../fixtures";

test("tenant portal renders lease details", async ({ page }) => {
  const tenantId = "mock-tenant-id";

  // Mock the public API response
  await page.route(`**/api/public/tenants/${tenantId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenant: {
          id: tenantId,
          name: "Jane Tenant",
          leases: [{ yearlyRent: 18000, property: { name: "Suite 101" } }],
        },
      }),
    });
  });

  await page.goto(`/t/${tenantId}`);
  await expect(page.getByText("Suite 101")).toBeVisible();
});
```

---

## 7. Best Practices & Quality Standards

### ✅ Do
- **Use user-centric locators**:
  - `page.getByRole('button', { name: /submit/i })`
  - `page.getByLabel(/email/i)`
  - `page.getByPlaceholder(/search/i)`
  - `page.getByText(/welcome/i)`
- **Use Web-First assertions**: Always use `await expect(locator).toBeVisible()` or `await expect(page).toHaveURL()`. These auto-retry until the condition passes or timeouts.
- **Isolate tests**: Every test should be able to run independently in any order.
- **Use fixtures**: Use `managerPage` / `tenantPage` rather than re-implementing login logic.

### ❌ Avoid
- **Arbitrary timeouts**: Never use `page.waitForTimeout(3000)`. Instead, wait for a specific element or state.
- **Fragile CSS / XPath selectors**: Avoid `page.locator('.btn-primary.mt-4 > span')` as minor UI redesigns will break them.
- **Hardcoding URLs**: Don't use `http://localhost:3000/dashboard` in actions. Use relative paths like `page.goto('/dashboard')` so the `baseURL` from configuration is respected.
- **Non-retrying assertions**: Avoid `expect(page.url()).toContain(...)`. Use `await expect(page).toHaveURL(/.../)` instead.

---

## 8. Troubleshooting Common Issues

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **Auth setup fails / Invalid login** | Dev database not running or test account unseeded | Run `npx tsx scripts/test-seeds/setup-pro-ent-accounts.ts` or ensure local dev server is accessible. |
| **Tests timeout waiting for server** | Next.js dev server taking longer to start | Increase `timeout` in `webServer` block in `playwright.config.ts`. |
| **Port conflict (3000 in use)** | Another process running on port 3000 | Kill process or set `reuseExistingServer: true` in `playwright.config.ts`. |
| **Missing browser binaries** | Fresh installation or new environment | Run `npx playwright install` to download browser engines. |
