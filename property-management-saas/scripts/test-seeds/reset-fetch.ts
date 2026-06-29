if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import "dotenv/config";

async function run() {
  const url = process.env.SUPABASE_URL + "/auth/v1/admin/users";
  const headers = {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY!,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, { headers });
  const data = await res.json();
  const user = data.users.find((u: any) => u.email === "djokn@gmail.com");

  if (!user) {
    console.log("User djokn@gmail.com not found in Supabase.");

    console.log("Creating user via API...");
    const createRes = await fetch(
      process.env.SUPABASE_URL + "/auth/v1/admin/users",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: "djokn@gmail.com",
          password: "Test1234!",
          email_confirm: true,
        }),
      },
    );
    console.log("Create user response:", await createRes.json());
    return;
  }

  console.log("Found user with ID:", user.id);

  const updateRes = await fetch(
    `${process.env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({ password: "Test1234!" }),
    },
  );

  if (updateRes.ok) {
    console.log("Password reset successfully to Test1234!");
  } else {
    console.log("Failed to reset password:", await updateRes.text());
  }
}

run().catch(console.error);
