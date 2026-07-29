import "dotenv/config";
import { supabaseAdmin } from "./lib/supabase";

async function main() {
  const emailOrId = process.argv[2];
  const newPassword = process.argv[3];

  if (!emailOrId || !newPassword) {
    console.error(
      "Usage: npx tsx src/reset-password.ts <email_or_user_id> <new_password>"
    );
    process.exit(1);
  }

  console.log(`Searching for user "${emailOrId}" in Supabase Auth...`);

  const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    console.error("❌ Failed to list users from Supabase Auth:", listError.message);
    process.exit(1);
  }

  const user = data?.users?.find(
    (u) =>
      u.id === emailOrId ||
      u.email?.toLowerCase() === emailOrId.toLowerCase()
  );

  if (!user) {
    console.error(`❌ User "${emailOrId}" was not found in Supabase Auth.`);
    process.exit(1);
  }

  console.log(`Updating password for ${user.email} (${user.id})...`);

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  );

  if (updateError) {
    console.error("❌ Failed to update password:", updateError.message);
    process.exit(1);
  }

  console.log(`\n========================================`);
  console.log(`✅ SUCCESS! Password updated for ${user.email}`);
  console.log(`User ID: ${user.id}`);
  console.log(`New Password: ${newPassword}`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
