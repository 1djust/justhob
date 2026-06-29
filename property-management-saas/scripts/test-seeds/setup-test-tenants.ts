if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function setupTestTenants() {
  const tenants = [
    {
      email: "free-tenant@justhob.com",
      name: "Free Plan Tenant",
      managerEmail: "free-manager@justhob.com",
    },
    {
      email: "pro-tenant@justhob.com",
      name: "Pro Plan Tenant",
      managerEmail: "manager@justhob.com",
    },
  ];

  for (const t of tenants) {
    console.log(`\nSetting up ${t.name}...`);

    // 1. Find Manager's Workspace
    const manager = await prisma.user.findUnique({
      where: { email: t.managerEmail },
      include: { workspaces: { include: { workspace: true } } },
    });

    if (!manager || manager.workspaces.length === 0) {
      console.error(
        `❌ Manager ${t.managerEmail} or their workspace not found. Skipping.`,
      );
      continue;
    }

    const workspace = manager.workspaces[0].workspace;

    // 2. Ensure Property and Unit exist
    let property = await prisma.property.findFirst({
      where: { workspaceId: workspace.id },
    });
    if (!property) {
      property = await prisma.property.create({
        data: {
          name: `${t.name} Residence`,
          address: "123 Test Street",
          workspaceId: workspace.id,
        },
      });
    }

    let unit = await prisma.unit.findFirst({
      where: { workspaceId: workspace.id },
    });
    if (!unit) {
      unit = await prisma.unit.create({
        data: {
          unitNumber: "A1",
          type: "MINI_FLAT",
          propertyId: property.id,
          workspaceId: workspace.id,
        },
      });
    }

    // 3. Create Tenant in Supabase Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: t.email,
        password: "Test1234!",
        email_confirm: true,
        user_metadata: { name: t.name },
      });

    if (authError && authError.message !== "User already registered") {
      console.error(`❌ Error creating ${t.email} in Auth:`, authError.message);
      continue;
    }

    const userId =
      authData.user?.id ||
      (await prisma.user.findUnique({ where: { email: t.email } }))?.id;

    if (!userId) {
      console.error(`❌ Could not find or create user for ${t.email}`);
      continue;
    }

    // 4. Ensure Prisma User
    await prisma.user.upsert({
      where: { id: userId },
      update: { name: t.name },
      create: { id: userId, email: t.email, name: t.name },
    });

    // 5. Add Tenant to Workspace as Member
    const member = await prisma.workspaceMember.findFirst({
      where: { userId: userId, workspaceId: workspace.id },
    });

    if (!member) {
      await prisma.workspaceMember.create({
        data: {
          userId: userId,
          workspaceId: workspace.id,
          role: "TENANT",
        },
      });
    }

    // 6. Create Tenant Profile & Lease
    let tenantProfile = await prisma.tenant.findFirst({
      where: { email: t.email, workspaceId: workspace.id },
    });

    if (!tenantProfile) {
      tenantProfile = await prisma.tenant.create({
        data: {
          name: t.name,
          email: t.email,
          workspaceId: workspace.id,
        },
      });
    }

    const lease = await prisma.lease.findFirst({
      where: { tenantId: tenantProfile.id },
    });
    if (!lease) {
      await prisma.lease.create({
        data: {
          tenantId: tenantProfile.id,
          propertyId: property.id,
          unitId: unit.id,
          startDate: new Date(),
          yearlyRent: 500000,
          status: "ACTIVE",
        },
      });
    }

    console.log(
      `✅ Success: ${t.email} is ready to log into the mobile app and test!`,
    );
  }

  console.log("\n✨ All test tenants created! Use password: Test1234!");
}

setupTestTenants()
  .catch(console.error)
  .finally(() => process.exit());
