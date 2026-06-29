import * as fs from "fs";
import dns from "dns/promises";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

async function run() {
  const envPath = "/home/djust/projects/justhub/property-management-saas/apps/api/.env";
  console.log(`Reading .env from: ${envPath}`);

  if (!fs.existsSync(envPath)) {
    console.error("Error: .env file not found.");
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  const getEnvVal = (key: string) => {
    const match = envContent.match(new RegExp(`^${key}\\s*=\\s*["']?([^"'\n]+)["']?`, "m"));
    return match ? match[1] : null;
  };

  const supabaseUrl = getEnvVal("SUPABASE_URL");
  const supabaseServiceKey = getEnvVal("SUPABASE_SERVICE_ROLE_KEY");
  const localKey = getEnvVal("ADMIN_SECURITY_KEY");
  const apiUrl = process.argv[2] || "https://propertystack.onrender.com";

  if (!supabaseUrl || !supabaseServiceKey || !localKey) {
    console.error("Error: Missing database configuration variables in .env");
    process.exit(1);
  }

  console.log(`Target API URL: ${apiUrl}`);
  console.log(`Read local ADMIN_SECURITY_KEY: ${localKey.substring(0, 8)}...`);

  // Apply DNS fallback for pooler
  const host = "aws-1-eu-north-1.pooler.supabase.com";
  try {
    const ips = await dns.resolve4(host);
    if (ips && ips.length > 0) {
      let ip = ips[0];
      if (ips.includes("51.21.189.77")) {
        ip = "51.21.189.77";
      } else if (ip === "51.21.18.29" && ips.length > 1) {
        ip = ips[1];
      }
      if (process.env.DATABASE_URL) {
        process.env.DATABASE_URL = process.env.DATABASE_URL.replace(host, ip);
      }
      if (process.env.DIRECT_URL) {
        process.env.DIRECT_URL = process.env.DIRECT_URL.replace(host, ip);
      }
    }
  } catch (err) {}

  // Use the standard environment-injected variables automatically parsed from .env
  const prisma = new PrismaClient();

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tempEmail = `temp_verification_admin_${Date.now()}@justhob.com`;
  const tempPassword = "TempVerifyPass123!@#";
  let createdUserId: string | null = null;

  try {
    console.log(`Creating temporary admin user in Supabase Auth: ${tempEmail}...`);
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: tempEmail,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError || !authData?.user) {
      throw new Error(`Failed to create auth user: ${authError?.message}`);
    }

    createdUserId = authData.user.id;
    console.log(`Created auth user with ID: ${createdUserId}`);

    console.log("Creating matching SUPER_ADMIN in Database via Prisma...");
    await prisma.user.create({
      data: {
        id: createdUserId,
        email: tempEmail,
        name: "Temp Security Verifier",
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });

    console.log("Signing in as temporary admin to get access token...");
    const { data: loginData, error: loginError } = await supabaseAdmin.auth.signInWithPassword({
      email: tempEmail,
      password: tempPassword,
    });

    if (loginError || !loginData?.session) {
      throw new Error(`Login failed: ${loginError?.message}`);
    }

    const token = loginData.session.access_token;
    console.log("Successfully logged in. Calling verify endpoint...");

    const res = await fetch(`${apiUrl}/api/admin/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ securityKey: localKey }),
    });

    const body = await res.text();
    console.log(`Response Status: ${res.status}`);
    console.log(`Response Body: ${body}`);

    if (res.status === 200) {
      console.log("🎉 SUCCESS: Verify endpoint accepted the request!");
    } else {
      console.log("❌ FAILED: Verify endpoint rejected the request.");
    }
  } catch (err: any) {
    console.error("Execution failed:", err.message || err);
  } finally {
    if (createdUserId) {
      console.log("Cleaning up temporary admin user...");
      try {
        await prisma.user.delete({ where: { id: createdUserId } });
        console.log("Prisma user deleted.");
      } catch (e: any) {
        console.error("Failed to delete Prisma user:", e.message || e);
      }

      try {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        console.log("Supabase Auth user deleted.");
      } catch (e: any) {
        console.error("Failed to delete Supabase Auth user:", e.message || e);
      }
    }
    await prisma.$disconnect();
  }
}

run().catch(console.error);
