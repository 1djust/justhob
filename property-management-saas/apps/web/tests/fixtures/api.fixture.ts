import { test as base, APIRequestContext } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

/**
 * API helper fixtures for PropertyStack E2E tests.
 *
 * Provides:
 * - `apiContext`: pre-configured APIRequestContext for direct API calls
 * - `mockApi()`:  utility to intercept and mock API responses
 */

const API_BASE = process.env.TEST_API_URL || "http://localhost:3001";

export const apiTest = base.extend<{
  apiContext: APIRequestContext;
  mockApi: (
    pattern: string,
    response: { status?: number; body: unknown },
  ) => Promise<void>;
}>({
  apiContext: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: API_BASE,
    });
    await use(context);
    await context.dispose();
  },

  mockApi: async ({ page }, use) => {
    const mocks: Array<() => Promise<void>> = [];

    const mock = async (
      pattern: string,
      response: { status?: number; body: unknown },
    ): Promise<void> => {
      const handler = async (route: Route): Promise<void> => {
        await route.fulfill({
          status: response.status ?? 200,
          contentType: "application/json",
          body: JSON.stringify(response.body),
        });
      };
      await page.route(`**${pattern}`, handler);
      mocks.push(async () => {
        await page.unroute(`**${pattern}`, handler);
      });
    };

    await use(mock);

    // Cleanup all mocks after test
    for (const cleanup of mocks) {
      await cleanup();
    }
  },
});

/**
 * Helper: wait for a specific API response in the network.
 * Useful for verifying that an action triggered the expected API call.
 */
export async function waitForApiCall(
  page: Page,
  urlPattern: string | RegExp,
  options?: { method?: string; timeout?: number },
): Promise<{ status: number; body: unknown }> {
  const response = await page.waitForResponse(
    (resp) => {
      const urlMatch =
        typeof urlPattern === "string"
          ? resp.url().includes(urlPattern)
          : urlPattern.test(resp.url());
      const methodMatch = options?.method
        ? resp.request().method() === options.method.toUpperCase()
        : true;
      return urlMatch && methodMatch;
    },
    { timeout: options?.timeout ?? 10_000 },
  );

  return {
    status: response.status(),
    body: await response.json().catch(() => null),
  };
}
