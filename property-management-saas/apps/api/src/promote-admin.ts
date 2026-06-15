import "dotenv/config";
import dns from "dns/promises";
import { supabaseAdmin } from "./lib/supabase";

async function main() {
  const emailOrId = process.argv[2];

  if (!emailOrId) {
    console.error("Usage: npx tsx src/promote-admin.ts <email_or_user_id>");
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
    // Find the user in Prisma
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: emailOrId, mode: "insensitive" } },
          { id: emailOrId }
        ]
      }
    });

    if (!user) {
      console.log(`User "${emailOrId}" not found in Prisma database. Creating new SUPER_ADMIN user...`);
      
      const password = process.argv[3] || "Test1234!";
      console.log(`Creating user in Supabase Auth with password: ${password}`);
      
      const { data: supaUser, error: createSupaError } = await supabaseAdmin.auth.admin.createUser({
        email: emailOrId,
        password: password,
        email_confirm: true,
        user_metadata: {
          role: "SUPER_ADMIN",
          name: emailOrId.split("@")[0]
        }
      });

      if (createSupaError || !supaUser?.user) {
        // If user already exists in Supabase but not in Prisma, handle it
        if (createSupaError?.message?.includes("already exists") || (createSupaError as any).status === 422) {
          console.log("User already exists in Supabase Auth. Attempting to retrieve credentials...");
          const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          const existingSupaUser = listData?.users?.find(u => u.email?.toLowerCase() === emailOrId.toLowerCase());
          
          if (existingSupaUser) {
            console.log(`Retrieved Supabase Auth user ID: ${existingSupaUser.id}. Creating database profile...`);
            await prisma.user.create({
              data: {
                id: existingSupaUser.id,
                email: emailOrId.toLowerCase(),
                role: "SUPER_ADMIN",
                name: emailOrId.split("@")[0]
              }
            });
            console.log("Database profile successfully created and upgraded to SUPER_ADMIN.");
            
            // Sync metadata
            await supabaseAdmin.auth.admin.updateUserById(existingSupaUser.id, {
              user_metadata: {
                ...existingSupaUser.user_metadata,
                role: "SUPER_ADMIN"
              }
            });
            console.log("Success! Super Admin initialized.");
            return;
          }
        }
        
        console.error(`Error creating user in Supabase Auth: ${createSupaError?.message || "Unknown error"}`);
        process.exit(1);
      }

      console.log(`Successfully created user in Supabase Auth (ID: ${supaUser.user.id}).`);

      // Create in Prisma
      console.log("Creating user profile in Prisma database...");
      const newUser = await prisma.user.create({
        data: {
          id: supaUser.user.id,
          email: emailOrId.toLowerCase(),
          role: "SUPER_ADMIN",
          name: emailOrId.split("@")[0]
        }
      });

      console.log(`Success! New SUPER_ADMIN user "${newUser.email}" has been created and activated.`);
      return;
    }

    console.log(`Found user: ${user.name || "N/A"} (${user.email}) - Current Role: ${user.role}`);

    if (user.role === "SUPER_ADMIN") {
      console.log("User is already a SUPER_ADMIN. Syncing Supabase metadata just in case...");
    } else {
      // Update Prisma role
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "SUPER_ADMIN" }
      });
      console.log("Prisma user role successfully upgraded to SUPER_ADMIN.");
    }

    // Update Supabase user metadata
    console.log("Syncing role update to Supabase auth user_metadata...");
    const { data: supaData, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(user.id);
    
    if (fetchError || !supaData?.user) {
      console.warn(`Warning: Could not fetch user from Supabase Auth: ${fetchError?.message || "User not found"}`);
    } else {
      const currentMetadata = supaData.user.user_metadata || {};
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...currentMetadata,
          role: "SUPER_ADMIN"
        }
      });

      if (updateError) {
        console.error(`Error updating Supabase user metadata: ${updateError.message}`);
      } else {
        console.log("Supabase user metadata successfully updated with role: SUPER_ADMIN.");
      }
    }

    console.log(`Success! User "${user.email}" is now a SUPER_ADMIN.`);
  } catch (error: any) {
    console.error("An error occurred during promotion:", error.message || error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
