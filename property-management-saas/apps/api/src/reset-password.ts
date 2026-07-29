import "dotenv/config";
import { supabaseAdmin } from "./lib/supabase";

export async function resetPassword(emailOrId: string, newPassword: string) {
  console.log(`Searching for user "${emailOrId}" in Supabase Auth...`);

  const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list users from Supabase Auth: ${listError.message}`);
  }

  const user = data?.users?.find(
    (u) =>
      u.id === emailOrId ||
      u.email?.toLowerCase() === emailOrId.toLowerCase()
  );

  if (!user) {
    throw new Error(`User "${emailOrId}" was not found in Supabase Auth.`);
  }

  console.log(`Updating password for ${user.email} (${user.id})...`);

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  );

  if (updateError) {
    throw new Error(`Failed to update password: ${updateError.message}`);
  }

  console.log(`\n========================================`);
  console.log(`✅ SUCCESS! Password updated for ${user.email}`);
  console.log(`User ID: ${user.id}`);
  console.log(`New Password: ${newPassword}`);
  console.log(`========================================\n`);

  return { id: user.id, email: user.email };
}

async function main() {
  const emailOrId = process.argv[2];
  const newPassword = process.argv[3];

  if (!emailOrId || !newPassword) {
    console.error(
      "Usage: npx tsx src/reset-password.ts <email_or_user_id> <new_password>"
    );
    process.exit(1);
  }

  try {
    await resetPassword(emailOrId, newPassword);
  } catch (err: any) {
    console.error("❌ Error:", err.message || err);
    process.exit(1);
  }
}

if (process.argv[1]?.includes("reset-password")) {
  main();
}
