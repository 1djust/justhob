import "dotenv/config";
import dns from "dns/promises";

async function main() {
  const host = "aws-1-eu-north-1.pooler.supabase.com";
  try {
    const ips = await dns.resolve4(host);
    if (ips && ips.length > 0) {
      const dbIp = ips.includes("51.21.18.29") ? "51.21.18.29" : ips[0];
      if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(host, dbIp);
      if (process.env.DIRECT_URL) process.env.DIRECT_URL = process.env.DIRECT_URL.replace(host, dbIp);
    }
  } catch {}

  const { supabaseAdmin } = await import("../lib/supabase");
  const { prisma } = await import("../lib/database");

  const email = "bitachonattorneys@gmail.com";
  console.log("==================================================");
  console.log("🔍 USER STATUS AUDIT: " + email);
  console.log("==================================================");

  // 1. Supabase Auth Check
  const { data: supaUsers } = await supabaseAdmin.auth.admin.listUsers();
  const supaUser = supaUsers?.users?.find((u) => u.email?.toLowerCase() === email);

  console.log("\n[1] SUPABASE AUTH STATUS:");
  if (supaUser) {
    console.log("  • Supabase ID      :", supaUser.id);
    console.log("  • Email Confirmed  :", supaUser.email_confirmed_at ? `YES (${supaUser.email_confirmed_at})` : "NO (Unconfirmed)");
    console.log("  • Account Created  :", supaUser.created_at);
    console.log("  • Last Sign In     :", supaUser.last_sign_in_at || "Never");
    console.log("  • User Metadata    :", JSON.stringify(supaUser.user_metadata, null, 2));
  } else {
    console.log("  ❌ Not found in Supabase Auth");
  }

  // 2. Prisma Database Profile & Workspaces
  const dbUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: {
      workspaces: {
        include: {
          workspace: {
            include: {
              properties: true,
              members: true,
            },
          },
        },
      },
    },
  });

  console.log("\n[2] DATABASE PROFILE & WORKSPACE STATUS:");
  if (dbUser) {
    console.log("  • Database User ID :", dbUser.id);
    console.log("  • Full Name        :", dbUser.name);
    console.log("  • Role             :", dbUser.role);
    console.log("  • Workspaces Count :", dbUser.workspaces.length);

    dbUser.workspaces.forEach((m, idx) => {
      console.log(`\n  --- Workspace #${idx + 1} ---`);
      console.log(`    • Workspace Name : ${m.workspace.name}`);
      console.log(`    • Workspace ID   : ${m.workspace.id}`);
      console.log(`    • Member Role    : ${m.role}`);
      console.log(`    • Properties     : ${m.workspace.properties.length}`);
    });
  } else {
    console.log("  ❌ Not found in Prisma database");
  }

  console.log("\n==================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
