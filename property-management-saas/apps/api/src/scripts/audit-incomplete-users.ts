import "dotenv/config";
import dns from "dns/promises";

async function main() {
  console.log("==================================================");
  console.log("🔍 PROPERTYSTACK INCOMPLETE SIGNUP & ONBOARDING AUDIT");
  console.log("==================================================");
  console.log(`Scan Timestamp: ${new Date().toISOString()}`);

  const host = "aws-1-eu-north-1.pooler.supabase.com";
  try {
    const ips = await dns.resolve4(host);
    if (ips && ips.length > 0) {
      const dbIp = ips.includes("51.21.18.29") ? "51.21.18.29" : ips[0];
      if (process.env.DATABASE_URL) {
        process.env.DATABASE_URL = process.env.DATABASE_URL.replace(host, dbIp);
      }
      if (process.env.DIRECT_URL) {
        process.env.DIRECT_URL = process.env.DIRECT_URL.replace(host, dbIp);
      }
    }
  } catch {
    // fallback
  }

  const { supabaseAdmin } = await import("../lib/supabase");
  const { prisma } = await import("../lib/database");

  let page = 1;
  const perPage = 100;
  let allSupaUsers: Array<{
    id: string;
    email?: string;
    created_at: string;
    email_confirmed_at?: string | null;
    last_sign_in_at?: string | null;
    user_metadata?: Record<string, unknown>;
  }> = [];

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("Supabase Error:", error.message);
      break;
    }
    if (!data?.users || data.users.length === 0) break;
    allSupaUsers = allSupaUsers.concat(data.users);
    if (data.users.length < perPage) break;
    page++;
  }

  const now = new Date();

  // 1. Unconfirmed Signups (Never verified email/OTP)
  const unconfirmed = allSupaUsers.filter((u) => !u.email_confirmed_at);

  console.log(`\n==================================================`);
  console.log(`📌 1. UNCONFIRMED USERS (YET TO VERIFY EMAIL/OTP): ${unconfirmed.length}`);
  console.log(`==================================================`);

  if (unconfirmed.length === 0) {
    console.log("No unconfirmed users found.");
  } else {
    unconfirmed.forEach((u, i) => {
      const createdAt = new Date(u.created_at);
      const ageHours = ((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)).toFixed(1);
      const ageDays = (parseFloat(ageHours) / 24).toFixed(1);
      const meta = u.user_metadata || {};
      const reminderCount = typeof meta.registration_reminder_count === "number"
        ? meta.registration_reminder_count
        : 0;
      const lastReminder = meta.last_registration_reminder_at || "Never";

      let statusEligibility = "";
      if (parseFloat(ageHours) < 24) {
        statusEligibility = "⏳ Under 24h old (Stage 1 scheduled in " + (24 - parseFloat(ageHours)).toFixed(1) + " hours)";
      } else if (reminderCount === 0 && parseFloat(ageDays) <= 14) {
        statusEligibility = "🚀 ELIGIBLE NOW for Stage 1 Follow-up Reminder";
      } else if (reminderCount === 1 && parseFloat(ageHours) >= 72 && parseFloat(ageDays) <= 14) {
        statusEligibility = "🚀 ELIGIBLE NOW for Stage 2 (Final) Reminder";
      } else if (reminderCount >= 2) {
        statusEligibility = "✅ Max reminders reached (2/2 sent)";
      } else if (parseFloat(ageDays) > 14) {
        statusEligibility = "⚠️ Account older than 14 days";
      }

      console.log(`[#${i + 1}] Email: ${u.email}`);
      console.log(`    User ID        : ${u.id}`);
      console.log(`    Full Name      : ${meta.name || "Not provided"}`);
      console.log(`    Role           : ${meta.role || "PROPERTY_MANAGER"}`);
      console.log(`    Signed Up At   : ${u.created_at} (${ageDays} days / ${ageHours}h ago)`);
      console.log(`    Reminders Sent : ${reminderCount}`);
      console.log(`    Last Reminder  : ${lastReminder}`);
      console.log(`    Action Status  : ${statusEligibility}`);
      console.log("--------------------------------------------------");
    });
  }

  // 2. Confirmed Email but Incomplete Profile / Inactive / Incomplete Onboarding
  try {
    const prismaUsers = await prisma.user.findMany({
      include: {
        workspaces: {
          include: {
            workspace: {
              include: {
                properties: true,
                tenants: true,
              },
            },
          },
        },
      },
    });

    const managersWithNoWorkspace = prismaUsers.filter(
      (u) => u.role === "PROPERTY_MANAGER" && u.workspaces.length === 0,
    );

    const managersWithEmptyWorkspace = prismaUsers.filter(
      (u) =>
        u.role === "PROPERTY_MANAGER" &&
        u.workspaces.length > 0 &&
        u.workspaces.every((w) => w.workspace.properties.length === 0),
    );

    console.log(`\n==================================================`);
    console.log(`📌 2. ONBOARDING INCOMPLETE (CONFIRMED MANAGERS):`);
    console.log(`==================================================`);
    console.log(`• Managers with No Workspace Created : ${managersWithNoWorkspace.length}`);
    console.log(`• Managers with Empty Workspace (0 properties): ${managersWithEmptyWorkspace.length}`);

    if (managersWithNoWorkspace.length > 0) {
      console.log("\nManagers with 0 Workspaces:");
      managersWithNoWorkspace.forEach((m, i) => {
        console.log(`  [${i + 1}] ${m.email} | Name: ${m.name || "N/A"} | Created: ${m.createdAt.toISOString()}`);
      });
    }

    if (managersWithEmptyWorkspace.length > 0) {
      console.log("\nManagers with 0 Properties in Workspace:");
      managersWithEmptyWorkspace.forEach((m, i) => {
        console.log(`  [${i + 1}] ${m.email} | Name: ${m.name || "N/A"} | Created: ${m.createdAt.toISOString()}`);
      });
    }
  } catch (dbErr) {
    console.log(`Prisma DB connection notice: ${(dbErr as Error).message}`);
  }

  console.log("\n==================================================");
  console.log(`Total Auth Accounts: ${allSupaUsers.length}`);
  console.log(`Unconfirmed Users  : ${unconfirmed.length}`);
  console.log("==================================================");
}

main().catch(console.error);
