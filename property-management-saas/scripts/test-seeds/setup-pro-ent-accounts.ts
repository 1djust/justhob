if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import * as dotenv from "dotenv";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env before initializing Prisma
dotenv.config({ path: join(process.cwd(), "apps/api/.env") });
dotenv.config({ path: join(process.cwd(), ".env") }); // Fallback

const { prisma } = require("./apps/api/src/lib/database");

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupProAndEntAccounts() {
  console.log("🚀 Setting up Pro and Enterprise Test Accounts...");

  const password = "Test1234!";
  const accounts = [
    {
      email: "manager_pro@justhob.com",
      name: "Pro Manager",
      plan: "PRO",
      workspaceName: "Pro Property Management",
    },
    {
      email: "manager_ent@justhob.com",
      name: "Enterprise Manager",
      plan: "ENTERPRISE",
      workspaceName: "Enterprise Holdings",
    },
  ];

  // Ensure Supabase Auth is ready
  console.log("🔑 Syncing Supabase passwords...");
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers();

  for (const acc of accounts) {
    let userId;
    const existingUser = users.find((u) => u.email === acc.email);
    if (existingUser) {
      await supabase.auth.admin.updateUserById(existingUser.id, { password });
      userId = existingUser.id;
    } else {
      const { data } = await supabase.auth.admin.createUser({
        email: acc.email,
        password,
        email_confirm: true,
      });
      if (data.user) userId = data.user.id;
    }

    if (!userId) {
      console.error(
        `❌ Failed to create or find Supabase user for ${acc.email}`,
      );
      continue;
    }

    // Sync to Prisma
    console.log(`🛡️  Syncing ${acc.email} to Prisma DB...`);
    const prismaUser = await prisma.user.upsert({
      where: { id: userId },
      update: { email: acc.email, role: "PROPERTY_MANAGER", name: acc.name },
      create: {
        id: userId,
        email: acc.email,
        name: acc.name,
        role: "PROPERTY_MANAGER",
      },
    });

    // Create Workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: acc.workspaceName,
        status: "ACTIVE",
        plan: acc.plan,
        members: {
          create: {
            userId: prismaUser.id,
            role: "PROPERTY_MANAGER",
          },
        },
      },
    });
    console.log(`✅ Created Workspace ${acc.workspaceName} (${acc.plan})`);

    // Create Sample Data (Property, Unit, Tenant, Lease)
    const property = await prisma.property.create({
      data: {
        name: `${acc.plan} Sample Property`,
        address: "123 Test Ave, Lagos",
        workspaceId: workspace.id,
        ownerId: prismaUser.id,
      },
    });

    const unit = await prisma.unit.create({
      data: {
        unitNumber: "A1",
        type: "TWO_BEDROOM_FLAT",
        status: "OCCUPIED",
        propertyId: property.id,
        workspaceId: workspace.id,
      },
    });

    const tenant = await prisma.tenant.create({
      data: {
        name: `${acc.plan} Tenant`,
        email: `tenant_${acc.plan.toLowerCase()}@justhob.com`,
        phone: "08012345678",
        workspaceId: workspace.id,
      },
    });

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);

    const lease = await prisma.lease.create({
      data: {
        tenantId: tenant.id,
        propertyId: property.id,
        unitId: unit.id,
        startDate,
        endDate,
        yearlyRent: acc.plan === "PRO" ? 1500000 : 5000000,
        status: "ACTIVE",
      },
    });

    console.log(
      `✅ Seeded Property, Unit, Tenant, and Lease for ${acc.email}\n`,
    );
  }

  console.log("✨ Pro and Enterprise scenarios ready!");
}

setupProAndEntAccounts()
  .catch(console.error)
  .finally(() => process.exit(0));
