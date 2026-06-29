if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function run() {
  const email = "djokn@gmail.com";
  console.log("Fixing login for " + email);

  // Check in Supabase
  const { data: listData, error: listError } =
    await supabaseAdmin.auth.admin.listUsers();
  if (listError) return console.log("List Error:", listError);

  let existingUser = listData.users.find((u: any) => u.email === email);

  if (existingUser) {
    console.log("Found in Supabase. Resetting password...");
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      { password: "Test1234!" },
    );
    if (error) console.log("Update Error:", error);
    else console.log("Password updated successfully.");
  } else {
    console.log("Not found in Supabase.");
  }
}

run()
  .catch(console.error)
  .finally(() => process.exit());
