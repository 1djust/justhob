if (process.env.NODE_ENV === "production") {
  console.warn("WARNING: Running database modification scripts in production environment!");
}

import "dotenv/config";
import { PrismaClient } from "@property-management/database";

const prisma = new PrismaClient();

async function run() {
  const args = process.argv.slice(2);
  const getArg = (name: string): string | null => {
    const idx = args.indexOf(name);
    if (idx !== -1 && idx + 1 < args.length) {
      return args[idx + 1];
    }
    return null;
  };

  const email = getArg("--email");
  const workspaceId = getArg("--workspace-id") || getArg("--id");
  const planArg = getArg("--plan") || "PRO";
  const monthsArg = getArg("--months") || "12";

  if (!email && !workspaceId) {
    console.error("Error: Please specify either --email <email> or --workspace-id <id>");
    console.log("Usage: npx tsx scripts/test-seeds/upgrade-workspace.ts --email <manager-email> --plan <FREE|PRO|ENTERPRISE> [--months <count>]");
    process.exit(1);
  }

  const validPlans = ["FREE", "PRO", "ENTERPRISE"];
  const plan = planArg.toUpperCase();
  if (!validPlans.includes(plan)) {
    console.error(`Error: Invalid plan '${planArg}'. Valid options: FREE, PRO, ENTERPRISE`);
    process.exit(1);
  }

  const months = parseInt(monthsArg, 10);
  if (isNaN(months) || months <= 0) {
    console.error(`Error: Invalid months count '${monthsArg}'. Must be a positive integer.`);
    process.exit(1);
  }

  let targetWorkspaceId = workspaceId;

  if (!targetWorkspaceId && email) {
    // Find workspace member where role is PROPERTY_MANAGER
    const member = await prisma.workspaceMember.findFirst({
      where: {
        role: "PROPERTY_MANAGER",
        user: { email: { equals: email, mode: "insensitive" } },
      },
      select: { workspaceId: true, user: { select: { email: true, name: true } } },
    });

    if (!member) {
      console.error(`Error: No workspace found for owner/manager email: ${email}`);
      process.exit(1);
    }
    targetWorkspaceId = member.workspaceId;
    console.log(`Found workspace owned by user ${member.user.name || member.user.email} (Workspace ID: ${targetWorkspaceId})`);
  }

  if (!targetWorkspaceId) {
    console.error("Error: Target workspace ID is unresolved.");
    process.exit(1);
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: targetWorkspaceId },
  });

  if (!workspace) {
    console.error(`Error: Workspace not found with ID '${targetWorkspaceId}'`);
    process.exit(1);
  }

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + months);

  const updated = await prisma.workspace.update({
    where: { id: targetWorkspaceId },
    data: {
      status: "ACTIVE",
      plan: plan as any,
      subscriptionExpiresAt: expiresAt,
    },
  });

  console.log("\n🚀 Workspace plan upgraded successfully!");
  console.log("-----------------------------------------");
  console.log(`Workspace ID:   ${updated.id}`);
  console.log(`Workspace Name: ${updated.name}`);
  console.log(`New Plan Tier:  ${updated.plan}`);
  console.log(`Status:         ${updated.status}`);
  console.log(`Expires At:     ${updated.subscriptionExpiresAt?.toLocaleDateString() || "N/A"}`);
  console.log("-----------------------------------------\n");
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
