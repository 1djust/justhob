import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const prisma = new PrismaClient();

const ATTACKER_TENANT_EMAIL = 'attacker-tenant@sec-test.com';
const PASSWORD = 'SecTestPassword123!';

async function run() {
  console.log('--- Verifying Privilege Escalation: Tenant Creating Property ---');

  const attackerWorkspace = await prisma.workspace.findFirst({ where: { name: 'SEC_TEST_ATTACKER_WS' } });
  
  if (!attackerWorkspace) {
    console.error('Setup data not found. Run setup.ts first.');
    return;
  }

  // 1. Sign in as Attacker TENANT
  const { data: auth, error: loginError } = await supabase.auth.signInWithPassword({
    email: ATTACKER_TENANT_EMAIL,
    password: PASSWORD,
  });

  if (loginError) {
    console.error('Login failed:', loginError.message);
    return;
  }

  const token = auth.session.access_token;
  const baseUrl = 'http://localhost:3001';

  // 2. Attempt to create a property as a TENANT
  console.log(`Using Attacker Tenant User: ${auth.user.id}`);
  console.log(`Targeting Workspace: ${attackerWorkspace.id}`);

  const payload = {
    name: 'TENANT CREATED PROPERTY',
    address: 'Vulnerable Street 1'
  };

  const response = await fetch(`${baseUrl}/api/workspaces/${attackerWorkspace.id}/properties`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();

  if (response.status === 201) {
    console.log('✅ VULNERABILITY CONFIRMED: Tenant successfully created a property!');
    console.log('Response:', JSON.stringify(result, null, 2));
    
    // Verify in DB
    const createdProperty = await prisma.property.findFirst({ 
      where: { name: 'TENANT CREATED PROPERTY', workspaceId: attackerWorkspace.id } 
    });
    if (createdProperty) {
      console.log('📊 DATABASE VERIFICATION: Property exists in DB.');
    }
  } else if (response.status === 403) {
    console.log('❌ VULNERABILITY NOT EXPLOITED: Server correctly returned 403 Forbidden.');
    console.log('Response:', JSON.stringify(result, null, 2));
  } else {
    console.log(`❓ UNEXPECTED RESPONSE: Status ${response.status}`);
    console.log('Response:', JSON.stringify(result, null, 2));
  }

  await prisma.$disconnect();
}

run();
