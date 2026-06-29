import "dotenv/config";
import dns from "dns/promises";
import { createClient } from "@supabase/supabase-js";

async function main() {
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

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    console.log("Fetching users from Supabase Auth...");
    let allSupaUsers: any[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        throw new Error(`Failed to list users: ${error.message}`);
      }

      if (!data?.users || data.users.length === 0) {
        break;
      }

      allSupaUsers = allSupaUsers.concat(data.users);
      if (data.users.length < perPage) {
        break;
      }
      page++;
    }

    console.log(`Retrieved ${allSupaUsers.length} users from Supabase Auth.`);

    let createdCount = 0;
    let updatedCount = 0;

    for (const supaUser of allSupaUsers) {
      const email = supaUser.email?.toLowerCase();
      if (!email) continue;

      const existingUser = await prisma.user.findUnique({
        where: { id: supaUser.id },
      });

      const metadata = supaUser.user_metadata || {};
      const name = metadata.name || email.split("@")[0];

      // Determine role: must match the Role enum in database (SUPER_ADMIN, PROPERTY_MANAGER, LANDLORD, TENANT)
      let role = metadata.role;

      // If role is not defined in metadata, check workspace membership in Prisma
      if (!role) {
        const membership = await prisma.workspaceMember.findFirst({
          where: { userId: supaUser.id },
          select: { role: true },
        });
        role = membership?.role || "PROPERTY_MANAGER";
      }

      // Preserve existing SUPER_ADMIN role in database
      if (existingUser?.role === "SUPER_ADMIN") {
        role = "SUPER_ADMIN";
      }

      if (
        !["SUPER_ADMIN", "PROPERTY_MANAGER", "LANDLORD", "TENANT"].includes(
          role,
        )
      ) {
        role = "PROPERTY_MANAGER";
      }

      if (!existingUser) {
        console.log(
          `Creating user in Prisma: ${email} (ID: ${supaUser.id}, Role: ${role})`,
        );

        // Also check if user exists by email but different ID
        const existingByEmail = await prisma.user.findUnique({
          where: { email },
        });

        if (existingByEmail) {
          console.log(
            `User email ${email} exists with different ID ${existingByEmail.id}. Updating ID...`,
          );
          await prisma.$executeRaw`UPDATE "User" SET id = ${supaUser.id} WHERE email = ${email}`;

          await prisma.user.update({
            where: { id: supaUser.id },
            data: {
              role: role as any,
              name,
            },
          });
          updatedCount++;
        } else {
          await prisma.user.create({
            data: {
              id: supaUser.id,
              email,
              name,
              role: role as any,
              isActive: true,
              createdAt: supaUser.created_at
                ? new Date(supaUser.created_at)
                : undefined,
            },
          });
          createdCount++;
        }
      } else {
        // Update role, metadata, and fix createdAt if desynced
        const supaCreatedAt = supaUser.created_at
          ? new Date(supaUser.created_at)
          : null;
        const needsDateFix =
          supaCreatedAt &&
          Math.abs(existingUser.createdAt.getTime() - supaCreatedAt.getTime()) >
            60000;

        if (
          existingUser.role !== role ||
          existingUser.name !== name ||
          existingUser.email !== email ||
          needsDateFix
        ) {
          console.log(
            `Updating user in Prisma: ${email} (Role: ${existingUser.role} -> ${role}${needsDateFix ? ", fixing createdAt" : ""})`,
          );
          await prisma.user.update({
            where: { id: supaUser.id },
            data: {
              email,
              role: role as any,
              name,
              ...(needsDateFix && supaCreatedAt
                ? { createdAt: supaCreatedAt }
                : {}),
            },
          });
          updatedCount++;
        }
      }
    }

    console.log(
      `Sync completed successfully! Created: ${createdCount}, Updated/Healed: ${updatedCount}`,
    );
  } catch (error: any) {
    console.error("Sync failed:", error.message || error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
