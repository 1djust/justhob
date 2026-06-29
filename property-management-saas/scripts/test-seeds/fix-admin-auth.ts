if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(process.cwd(), "apps/api/.env") });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetPassword() {
  const email = "justusole@gmail.com";
  const newPassword = "Test1234!";

  console.log(`Checking user: ${email}...`);

  const {
    data: { users },
    error: listError,
  } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error("Error listing users:", listError);
    return;
  }

  const user = users.find((u) => u.email === email);

  if (!user) {
    console.log(`User ${email} not found in Supabase Auth. Creating...`);
    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password: newPassword,
        email_confirm: true,
      });

    if (createError) {
      console.error("Error creating user:", createError);
    } else {
      console.log("User created successfully with password Test1234!");
    }
  } else {
    console.log(`User found (ID: ${user.id}). Updating password...`);
    const { data: updatedUser, error: updateError } =
      await supabase.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

    if (updateError) {
      console.error("Error updating password:", updateError);
    } else {
      console.log("Password updated successfully to Test1234!");
    }
  }
}

resetPassword().catch(console.error);
