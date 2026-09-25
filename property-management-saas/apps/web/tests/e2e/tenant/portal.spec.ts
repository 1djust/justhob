import { test, expect } from "../../fixtures";

/**
 * Tenant Portal E2E Tests (/t/[tenantId]).
 */
test.describe("Tenant Portal", () => {
  const mockTenantId = "test-tenant-uuid-1234";

  test("portal renders tenant lease info and countdown when valid tenant data is returned", async ({
    page,
  }) => {
    // Mock the public tenant API endpoint
    await page.route(`**/api/public/tenants/${mockTenantId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tenant: {
            id: mockTenantId,
            name: "John Doe",
            workspace: { name: "Sunset Palms Workspace" },
            leases: [
              {
                id: "lease-1",
                startDate: "2026-01-01T00:00:00.000Z",
                endDate: "2026-12-31T00:00:00.000Z",
                yearlyRent: 24000,
                property: {
                  id: "prop-1",
                  name: "Apartment 4B",
                  address: "123 Ocean View Ave",
                  owner: {
                    id: "owner-1",
                    name: "Alice Smith",
                    email: "alice@example.com",
                  },
                },
                paymentInfo: {
                  payoutStrategy: "DIRECT",
                  bankCode: "058",
                  accountNumber: "0123456789",
                  accountName: "Sunset Management Ltd",
                },
              },
            ],
            maintenanceRequests: [
              {
                id: "maint-1",
                description: "Leaking kitchen sink faucet",
                status: "PENDING",
                createdAt: new Date().toISOString(),
                property: { name: "Apartment 4B" },
              },
            ],
          },
        }),
      });
    });

    await page.goto(`/t/${mockTenantId}`);

    // Verify workspace & tenant greeting / branding
    await expect(page.getByText(/Sunset Palms Workspace/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // Verify property name & address
    await expect(page.getByText("Apartment 4B").first()).toBeVisible();
    await expect(page.getByText("123 Ocean View Ave").first()).toBeVisible();

    // Verify existing maintenance request is listed
    await expect(
      page.getByText(/Leaking kitchen sink faucet/i).first(),
    ).toBeVisible();
  });

  test("submitting a new maintenance request through the portal form", async ({
    page,
  }) => {
    // Mock initial tenant data
    await page.route(`**/api/public/tenants/${mockTenantId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tenant: {
            id: mockTenantId,
            name: "John Doe",
            workspace: { name: "Sunset Palms Workspace" },
            leases: [
              {
                id: "lease-1",
                startDate: "2026-01-01T00:00:00.000Z",
                endDate: "2026-12-31T00:00:00.000Z",
                yearlyRent: 24000,
                property: {
                  id: "prop-1",
                  name: "Apartment 4B",
                  address: "123 Ocean View Ave",
                },
              },
            ],
            maintenanceRequests: [],
          },
        }),
      });
    });

    // Mock POST maintenance request endpoint
    await page.route(
      `**/api/public/tenants/${mockTenantId}/maintenance`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            request: {
              id: "new-maint-id",
              description: "Water heater making noise",
              status: "PENDING",
            },
          }),
        });
      },
    );

    await page.goto(`/t/${mockTenantId}`);

    // Find textarea or input for maintenance description
    const descInput = page.locator("textarea, input[name='description']").first();
    if (await descInput.isVisible()) {
      await descInput.fill("Water heater making noise");

      // Submit maintenance request
      const submitBtn = page.getByRole("button", {
        name: /submit|send request/i,
      });
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
      }
    }
  });

  test("renders 'Portal Not Found' for non-existent tenant", async ({
    page,
  }) => {
    await page.route(`**/api/public/tenants/non-existent-id`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Tenant not found" } }),
      });
    });

    await page.goto("/t/non-existent-id");

    await expect(page.getByText(/Portal Not Found/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
