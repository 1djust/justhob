const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://gushvedprjygyauwzvnf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1c2h2ZWRwcmp5Z3lhdXd6dm5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwNzE5MywiZXhwIjoyMDkwMzgzMTkzfQ.0nmzWmQ2uk7Fi025Fv5J27KXBfGsVxcDuE5DTTd3wUU'
);

async function main() {
  const { data } = await supabase.auth.admin.listUsers();
  for (const u of data.users) {
    const m = u.user_metadata || {};
    // Force mustChangePassword=true on ALL users except the main manager
    if (u.email === 'justusolawole@gmail.com') {
      console.log('SKIP manager:', u.email);
      continue;
    }
    console.log('Updating:', u.email, '| current mustChangePassword:', m.mustChangePassword);
    const { error } = await supabase.auth.admin.updateUserById(u.id, {
      user_metadata: { ...m, mustChangePassword: true }
    });
    console.log(error ? 'ERROR: ' + error.message : 'OK');
  }
  console.log('DONE - all non-manager users now have mustChangePassword=true');
}
main();
