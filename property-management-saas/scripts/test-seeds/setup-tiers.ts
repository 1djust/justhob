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

async function setupTiers() {
  const users = [
    { email: "free-manager@justhob.com", plan: "FREE", name: "Free Manager" },
    {
      email: "enterprise-manager@justhob.com",
      plan: "ENTERPRISE",
      name: "Enterprise Manager",
    },
  ];

  for (const userData of users) {
    console.log(`Setting up ${userData.name}...`);

    // 1. Create in Supabase Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: "Test1234!",
        email_confirm: true,
        user_metadata: { name: userData.name },
      });

    if (authError && authError.message !== "User already registered") {
      console.error(`Error creating ${userData.email}:`, authError.message);
      continue;
    }

    const userId =
      authData.user?.id ||
      (await prisma.user.findUnique({ where: { email: userData.email } }))?.id;

    if (!userId) {
      console.error(`Could not find or create user for ${userData.email}`);
      continue;
    }

    // 2. Ensure Prisma User
    await prisma.user.upsert({
      where: { id: userId },
      update: { name: userData.name },
      create: { id: userId, email: userData.email, name: userData.name },
    });

    // 3. Create Workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: `${userData.name}'s Workspace`,
        plan: userData.plan as import("@prisma/client").SubscriptionPlan,
        members: {
          create: {
            userId: userId,
            role: "PROPERTY_MANAGER",
          },
        },
      },
    });

    console.log(
      `✅ Success: ${userData.email} is ready on ${userData.plan} plan.`,
    );
  }

  console.log("\n✨ All test users created!");
}

setupTiers()
  .catch(console.error)
  .finally(() => process.exit());
