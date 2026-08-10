import "dotenv/config";
import dns from "dns/promises";
import { supabaseAdmin } from "./lib/supabase";

async function main() {
  const emailOrId = process.argv[2];

  if (!emailOrId) {
    console.error("Usage: npx tsx src/confirm-user.ts <email_or_user_id>");
    process.exit(1);
  }

  // DNS fallback for Supabase pooler in WSL
  const host = "aws-1-eu-north-1.pooler.supabase.com";
  try {
    const ips = await dns.resolve4(host);
    if (ips && ips.length > 0) {
      const ip = ips[0];
      if (process.env.DATABASE_URL) {
        process.env.DATABASE_URL = process.env.DATABASE_URL.replace(host, ip);
      }
      if (process.env.DIRECT_URL) {
        process.env.DIRECT_URL = process.env.DIRECT_URL.replace(host, ip);
      }
    }
  } catch (err) {
    // Silent fallback
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DIRECT_URL || process.env.DATABASE_URL,
      },
    },
  });

  try {
    // 1. Look up user in Supabase Auth
    const { data: listData, error: listError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      throw new Error(`Failed to list Supabase users: ${listError.message}`);
    }

    const targetUser = listData.users.find(
      (u) =>
        u.email?.toLowerCase() === emailOrId.toLowerCase() ||
        u.id === emailOrId,
    );

    if (!targetUser) {
      console.error(`User "${emailOrId}" not found in Supabase Auth.`);
      process.exit(1);
    }

    console.log(
      `Found user: ${targetUser.email} (ID: ${targetUser.id}). Confirming email...`,
    );

    // 2. Mark email as confirmed in Supabase Auth
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
        email_confirm: true,
        user_metadata: {
          ...targetUser.user_metadata,
          email_verified: true,
        },
      });

    if (updateError) {
      throw new Error(
        `Failed to confirm user in Supabase: ${updateError.message}`,
      );
    }

    // 3. Ensure Prisma profile exists and is synced
    const existingPrisma = await prisma.user.findUnique({
      where: { id: targetUser.id },
    });

    if (!existingPrisma && targetUser.email) {
      const role =
        (targetUser.user_metadata?.role as any) || "PROPERTY_MANAGER";
      const name =
        targetUser.user_metadata?.name || targetUser.email.split("@")[0];

      await prisma.user.create({
        data: {
          id: targetUser.id,
          email: targetUser.email.toLowerCase(),
          name,
          role,
          isActive: true,
        },
      });
      console.log(`Created matching Prisma user profile with role: ${role}`);
    }

    console.log(`\n✅ Success! User "${targetUser.email}" is now confirmed.`);
    console.log(
      "The user can now log into the mobile app and web portal immediately.",
    );
  } catch (error: any) {
    console.error("Error confirming user:", error.message || error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes("confirm-user")) {
  main();
}
