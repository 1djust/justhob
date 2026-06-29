import * as fs from "fs";

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
  const supabaseAnonKey = getEnvVal("SUPABASE_ANON_KEY");
  const localKey = getEnvVal("ADMIN_SECURITY_KEY");
  const apiUrl = "https://propertystack.onrender.com";

  if (!supabaseUrl || !supabaseAnonKey || !localKey) {
    console.error("Error: Missing database configuration variables in .env");
    process.exit(1);
  }

  console.log(`Read local ADMIN_SECURITY_KEY: ${localKey.substring(0, 8)}...`);

  console.log("Authenticating as admin@justhob.com via Supabase Auth API...");
  const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "apikey": supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "admin@justhob.com",
      password: "Test1234!",
    }),
  });

  if (!authRes.ok) {
    const errBody = await authRes.text();
    console.error(`Authentication failed (Status ${authRes.status}): ${errBody}`);
    process.exit(1);
  }

  const authData = await authRes.json();
  const token = authData.access_token;
  console.log("Successfully logged in. Calling remote verify endpoint...");

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
    console.log("🎉 SUCCESS: Remote server is successfully verified using the new ADMIN_SECURITY_KEY!");
  } else {
    console.log("❌ FAILED: The remote server did not accept the new key. It might still be running the old config or not restarted.");
  }
}

run().catch(console.error);
