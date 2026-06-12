if (process.env.NODE_ENV === "production") throw new Error("CRITICAL: Cannot run test scripts in production!");

import * as dotenv from "dotenv";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env before initializing Prisma
dotenv.config({ path: join(process.cwd(), "apps/api/.env") });
dotenv.config({ path: join(process.cwd(), ".env") }); // Fallback

// We import prisma dynamically or require it so that the environment variables are loaded FIRST
const { prisma } = require("./apps/api/src/lib/database");

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupMegaScenario() {
  console.log("🚀 Setting up Mega Lifecycle Scenario...");

  const password = "Test1234!";
  const usersToSetup = [
    "tenant@justhob.com",
    "admin@justhob.com",
    "manager@justhob.com",
  ];

  const scenarioArg = process.argv[2];
  if (
    !scenarioArg ||
    !["90", "60", "30", "7", "1", "14", "21", "31"].includes(scenarioArg)
  ) {
    console.error(
      "❌ Please provide a valid scenario argument: 90, 60, 30, 7, or 1",
    );
    console.log("Example: npx tsx setup-mega-test.ts 90");
    process.exit(1);
  }
  const scenario = parseInt(scenarioArg, 10);

  // 1. Ensure Supabase Auth is ready for all test users
  console.log("🔑 Syncing Supabase passwords...");
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers();
  for (const email of usersToSetup) {
    const user = users.find((u) => u.email === email);
    if (user) {
      await supabase.auth.admin.updateUserById(user.id, { password });
    } else {
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    }
  }

  // Ensure admin@justhob.com is synced to Prisma DB with SUPER_ADMIN role.
  // Without this, the Supabase token resolves to a UUID that doesn't exist in
  // the Prisma User table, causing a 401 "Invalid token" on every admin API call.
  console.log("🛡️  Syncing admin user to Prisma DB...");
  const {
    data: { users: freshUsers },
  } = await supabase.auth.admin.listUsers();
  const supaAdmin = freshUsers.find((u) => u.email === "admin@justhob.com");
  if (supaAdmin) {
    await prisma.user.upsert({
      where: { id: supaAdmin.id },
      update: { email: "admin@justhob.com", role: "SUPER_ADMIN" },
      create: {
        id: supaAdmin.id,
        email: "admin@justhob.com",
        name: "Platform Admin",
        role: "SUPER_ADMIN",
      },
    });
    console.log(
      `✅ admin@justhob.com synced to Prisma (UUID: ${supaAdmin.id})`,
    );
  } else {
    console.warn(
      "⚠️  Could not find admin@justhob.com in Supabase — skipping Prisma sync",
    );
  }

  // Clear old notifications and reminders to ensure a clean slate for testing scenarios
  console.log("🧹 Clearing old test notifications...");
  await prisma.notification.deleteMany({
    where: { user: { email: { in: usersToSetup } } },
  });
  await prisma.rentReminder.deleteMany({});

  // 2. Setup Lease Expiry Milestones
  const setupLease = async (email: string, daysOffset: number) => {
    const tenant = await prisma.tenant.findFirst({
      where: { email },
      include: { leases: true },
    });
    if (tenant && tenant.leases.length > 0) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysOffset);
      targetDate.setHours(0, 0, 0, 0);
      await prisma.lease.update({
        where: { id: tenant.leases[0].id },
        data: { status: "ACTIVE", endDate: targetDate },
      });
      console.log(`📅 ${email}: Set to expire in ${daysOffset} days.`);
    }
  };

  const tenantEmail = "tenant@justhob.com";

  if (scenario === 90 || scenario === 60 || scenario === 30) {
    await setupLease(tenantEmail, scenario);
  } else if (scenario === 1) {
    // 1 day overdue: set lease well into the future so no lease expiry alert fires,
    // then move the payment due date to yesterday.
    const overdueTenant = await prisma.tenant.findFirst({
      where: { email: tenantEmail },
      include: { leases: true },
    });
    if (overdueTenant && overdueTenant.leases.length > 0) {
      const leaseId = overdueTenant.leases[0].id;

      // Push lease end date 1 year out so it doesn't trigger lease expiry alerts
      const oneYearOut = new Date();
      oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
      await prisma.lease.update({
        where: { id: leaseId },
        data: { status: "ACTIVE", endDate: oneYearOut },
      });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Delete all old pending payments to avoid duplicates
      await prisma.payment.deleteMany({
        where: { leaseId, status: { in: ["PENDING", "OVERDUE"] } },
      });

      // Create a fresh overdue payment
      await prisma.payment.create({
        data: {
          leaseId,
          workspaceId: overdueTenant.workspaceId,
          amount: overdueTenant.leases[0].yearlyRent,
          status: "PENDING",
          dueDate: yesterday,
          note: "Overdue Rent",
        },
      });
      console.log(`💸 ${tenantEmail}: Set payment to 1 day overdue.`);
    }
  } else if ([7, 14, 21, 31].includes(scenario)) {
    // 7 days pre-due, or 14/21/30 days overdue
    const tenant = await prisma.tenant.findFirst({
      where: { email: tenantEmail },
      include: { leases: true },
    });
    if (tenant && tenant.leases.length > 0) {
      const leaseId = tenant.leases[0].id;

      // Push lease end date 1 year out so it doesn't trigger lease expiry alerts
      const oneYearOut = new Date();
      oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
      await prisma.lease.update({
        where: { id: leaseId },
        data: { status: "ACTIVE", endDate: oneYearOut },
      });

      const targetDate = new Date();
      if (scenario === 7) {
        targetDate.setDate(targetDate.getDate() + 7);
      } else {
        targetDate.setDate(
          targetDate.getDate() - (scenario === 31 ? 30 : scenario),
        );
      }
      targetDate.setHours(0, 0, 0, 0);

      // Delete all old pending/overdue payments to avoid duplicates
      await prisma.payment.deleteMany({
        where: { leaseId, status: { in: ["PENDING", "OVERDUE"] } },
      });

      // Create a fresh payment
      await prisma.payment.create({
        data: {
          leaseId,
          workspaceId: tenant.workspaceId,
          amount: tenant.leases[0].yearlyRent,
          status: "PENDING",
          dueDate: targetDate,
          note: scenario === 7 ? "Upcoming Rent" : "Overdue Rent",
          evictionNoticeSent: false,
          ...(scenario === 31
            ? {
                evictionDate: new Date(
                  new Date().getTime() + 7 * 24 * 60 * 60 * 1000,
                ),
              }
            : {}),
        },
      });
      console.log(
        `💰 ${tenantEmail}: Created payment ${scenario === 7 ? "due in 7 days" : `overdue by ${scenario} days`}.`,
      );
    }
  }

  console.log("\n✨ All scenarios ready!");

  // Update the actual property OWNER's (landlord) bank details for the Payment Account card
  const landlordUser = await prisma.user.findUnique({
    where: { email: "landlord@justhob.com" },
  });
  const tenant = await prisma.tenant.findFirst({
    where: { email: "tenant@justhob.com" },
  });

  if (landlordUser && tenant) {
    await prisma.workspaceMember.updateMany({
      where: {
        userId: landlordUser.id,
        workspaceId: tenant.workspaceId,
      },
      data: {
        bankCode: "044", // Access Bank
        accountNumber: "1234567890",
        accountName: "Emerald Gardens Property",
      },
    });
    console.log(
      "✅ Landlord bank details updated (Emerald Gardens Property / Access Bank)",
    );
  }

  console.log('👉 Click "Run System Jobs Now" to trigger all notifications.');
}

setupMegaScenario()
  .catch(console.error)
  .finally(() => process.exit(0));
