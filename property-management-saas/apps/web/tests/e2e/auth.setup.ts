import { test as setup } from "@playwright/test";
import {
  loginAndSaveState,
  MANAGER_STATE_PATH,
  TENANT_STATE_PATH,
} from "../fixtures/auth.fixture";

/**
 * Global auth setup — runs ONCE before all test projects.
 *
 * Logs in as Manager and Tenant via the real login form,
 * then saves session state to JSON files for reuse.
 */
setup("authenticate as manager", async ({ page }) => {
  await loginAndSaveState(page, "manager", MANAGER_STATE_PATH);
});

setup("authenticate as tenant", async ({ page }) => {
  await loginAndSaveState(page, "tenant", TENANT_STATE_PATH);
});
