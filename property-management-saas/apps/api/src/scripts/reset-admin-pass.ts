import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || "propertystackapp@gmail.com";
  const newPassword = process.argv[2] || "Admin@123456";

  console.log(`Checking account status for ${email}...`);

  // 1. Check Supabase Auth with pagination
  let user: any = null;
  let page = 1;
  const perPage = 50;

  while (true) {
    const { data: usersData, error: listError } =
      await supabaseAdmin.auth.admin.listUsers({ page, perPage });

    if (listError) {
      console.error("Failed to list Supabase users:", listError.message);
      process.exit(1);
    }

    user = usersData.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );

    if (user || usersData.users.length < perPage) {
      break;
    }
    page++;
  }

  if (!user) {
    console.log(`User ${email} not found in Supabase Auth. Creating account...`);
    const { data: createData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: newPassword,
        email_confirm: true,
        user_metadata: { name: "Justus Ogunduyi" },
      });

    if (createError) {
      console.error("Failed to create user in Supabase Auth:", createError.message);
      process.exit(1);
    }
    user = createData.user;
    console.log(`Successfully created user ${email} in Supabase Auth with ID: ${user.id}`);
  } else {
    console.log(`User ${email} found in Supabase Auth (ID: ${user.id}). Updating password...`);
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

    if (updateError) {
      console.error("Failed to update password:", updateError.message);
      process.exit(1);
    }
    console.log(`Successfully updated password for ${email}.`);
  }

  // 2. Ensure Prisma database user record exists and has SUPER_ADMIN role
  const existingDbUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!existingDbUser) {
    console.log(`Creating Prisma user record for ${email} with SUPER_ADMIN role...`);
    await prisma.user.create({
      data: {
        id: user.id,
        email,
        name: "Justus Ogunduyi",
        role: "SUPER_ADMIN",
      },
    });
  } else if (existingDbUser.role !== "SUPER_ADMIN") {
    console.log(`Updating Prisma user ${email} role to SUPER_ADMIN...`);
    await prisma.user.update({
      where: { email },
      data: { role: "SUPER_ADMIN" },
    });
  }

  console.log(`\n==================================================`);
  console.log(`SUCCESS: Admin credentials updated!`);
  console.log(`Email    : ${email}`);
  console.log(`Password : ${newPassword}`);
  console.log(`Role     : SUPER_ADMIN`);
  console.log(`==================================================\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
