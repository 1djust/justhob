import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), 'apps/api/.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixTenantAuth() {
  const email = 'tenant@justhob.com';
  const password = 'Test1234!';
  
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === email);

  if (user) {
    await supabase.auth.admin.updateUserById(user.id, { password });
    console.log(`✅ Password for ${email} reset to ${password}`);
  } else {
    await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    console.log(`✅ User ${email} created with password ${password}`);
  }
}

fixTenantAuth().catch(console.error);
