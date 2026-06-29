import "dotenv/config";
import dns from "dns/promises";
import { supabaseAdmin } from "./lib/supabase";

async function main() {
  const emailOrId = process.argv[2];

  if (!emailOrId) {
    console.error("Usage: npx tsx src/remove-user.ts <email_or_user_id>");
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
    // 1. Find the user in Prisma
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: emailOrId, mode: "insensitive" } },
          { id: emailOrId },
        ],
      },
    });

    let userId = user?.id;
    let userEmail = user?.email;

    if (user) {
      console.log(
        `Found user in Prisma: ${user.name || "N/A"} (${user.email}) - Role: ${user.role}`,
      );
    } else {
      console.log(
        `User "${emailOrId}" not found in Prisma. Checking Supabase Auth...`,
      );
    }

    // 2. Look up / Delete user in Supabase Auth
    // If we have an email, we can list users or get by email, otherwise delete by ID.
    let supaUserDeleted = false;

    if (userId) {
      console.log(`Deleting user from Supabase Auth by ID: ${userId}...`);
      const { error: supaErr } =
        await supabaseAdmin.auth.admin.deleteUser(userId);
      if (supaErr) {
        console.warn(
          `Warning: Supabase Auth deletion returned error: ${supaErr.message}`,
        );
      } else {
        console.log("Successfully deleted user from Supabase Auth.");
        supaUserDeleted = true;
      }
    } else {
      // If not found in Prisma, try fetching from Supabase directly to clean up orphaned accounts
      const { data: listData, error: listError } =
        await supabaseAdmin.auth.admin.listUsers();
      if (listError) {
        console.error(`Error listing Supabase users: ${listError.message}`);
      } else {
        const foundSupaUser = listData.users.find(
          (u) => u.email === emailOrId || u.id === emailOrId,
        );

        if (foundSupaUser) {
          userId = foundSupaUser.id;
          userEmail = foundSupaUser.email;
          console.log(
            `Found orphaned user in Supabase: (${userEmail}) [ID: ${userId}]. Deleting...`,
          );
          const { error: supaErr } =
            await supabaseAdmin.auth.admin.deleteUser(userId);
          if (supaErr) {
            console.error(`Error deleting Supabase user: ${supaErr.message}`);
          } else {
            console.log("Successfully deleted user from Supabase Auth.");
            supaUserDeleted = true;
          }
        }
      }
    }

    // 3. Delete user from Prisma if they existed there
    if (user) {
      console.log(`Deleting user from Prisma Database (ID: ${user.id})...`);
      await prisma.user.delete({
        where: { id: user.id },
      });
      console.log("Successfully deleted user profile from Prisma database.");
    }

    if (!user && !supaUserDeleted) {
      console.error(
        `Error: User "${emailOrId}" could not be found in either Prisma or Supabase Auth.`,
      );
      process.exit(1);
    }

    console.log(
      `Success! User "${userEmail || emailOrId}" has been permanently removed from the system.`,
    );
  } catch (error: any) {
    console.error(
      "An error occurred during user deletion:",
      error.message || error,
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
