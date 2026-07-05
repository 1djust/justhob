import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function run() {
  console.log("Searching for landlord@justhob.com in Supabase...");
  try {
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const landlord = usersData.users.find(u => u.email === "landlord@justhob.com");
    if (!landlord) {
      console.log("Landlord not found! Creating landlord user...");
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email: "landlord@justhob.com",
        password: "Test1234!",
        email_confirm: true,
        user_metadata: { name: "Test Landlord", role: "LANDLORD" }
      });
      if (createError) throw createError;
      console.log("Landlord created successfully: ID =", createData.user?.id);
    } else {
      console.log("Landlord found. Updating password to Test1234!...");
      const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(landlord.id, {
        password: "Test1234!",
        email_confirm: true
      });
      if (updateError) throw updateError;
      console.log("Landlord password updated successfully!");
    }
  } catch (err) {
    console.error("Error occurred:", err);
  }
}

run();
