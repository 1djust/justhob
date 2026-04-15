import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const prisma = new PrismaClient();

const ATTACKER_EMAIL = 'attacker@sec-test.com';
const VICTIM_EMAIL = 'victim@sec-test.com';
const PASSWORD = 'SecTestPassword123!';

async function setup() {
  console.log('--- Setting up Security Test Data ---');

  try {
    // 1. Create Victim Workspace & User
    let victimWorkspace = await prisma.workspace.create({
      data: { name: 'SEC_TEST_VICTIM_WS' }
    });
    
    const { data: vAuth, error: vError } = await supabase.auth.admin.createUser({
      email: VICTIM_EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Victim User', role: 'PROPERTY_MANAGER' }
    });
    if (vError) throw vError;

    await prisma.user.create({
      data: { id: vAuth.user.id, email: VICTIM_EMAIL, name: 'Victim User' }
    });

    await prisma.workspaceMember.create({
      data: { userId: vAuth.user.id, workspaceId: victimWorkspace.id, role: 'PROPERTY_MANAGER' }
    });

    // Create a Victim Tenant and Payment
    const victimTenant = await prisma.tenant.create({
      data: { name: 'Victim Tenant', email: 'v-tenant@sec-test.com', workspaceId: victimWorkspace.id }
    });

    const victimProperty = await prisma.property.create({
      data: { name: 'Victim Property', address: '123 Victim Lane', workspaceId: victimWorkspace.id }
    });

    const victimLease = await prisma.lease.create({
      data: { tenantId: victimTenant.id, propertyId: victimProperty.id, startDate: new Date() }
    });

    const victimPayment = await prisma.payment.create({
      data: { leaseId: victimLease.id, amount: 1000, dueDate: new Date(), status: 'PENDING' }
    });

    console.log(`Victim Setup: Workspace=${victimWorkspace.id}, Tenant=${victimTenant.id}, Payment=${victimPayment.id}`);

    // 2. Create Attacker Workspace & User
    let attackerWorkspace = await prisma.workspace.create({
      data: { name: 'SEC_TEST_ATTACKER_WS' }
    });

    const { data: aAuth, error: aError } = await supabase.auth.admin.createUser({
      email: ATTACKER_EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Attacker User', role: 'PROPERTY_MANAGER' }
    });
    if (aError) throw aError;

    await prisma.user.create({
      data: { id: aAuth.user.id, email: ATTACKER_EMAIL, name: 'Attacker User' }
    });

    await prisma.workspaceMember.create({
      data: { userId: aAuth.user.id, workspaceId: attackerWorkspace.id, role: 'PROPERTY_MANAGER' }
    });

    // Also create a "TENANT" membership for the attacker in their own workspace to test privilege escalation
    const { data: tAuth, error: tError } = await supabase.auth.admin.createUser({
      email: 'attacker-tenant@sec-test.com',
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Attacker Tenant', role: 'TENANT' }
    });
    if (tError) throw tError;

    await prisma.user.create({
      data: { id: tAuth.user.id, email: 'attacker-tenant@sec-test.com', name: 'Attacker Tenant' }
    });

    await prisma.workspaceMember.create({
      data: { userId: tAuth.user.id, workspaceId: attackerWorkspace.id, role: 'TENANT' }
    });

    console.log(`Attacker Setup: Workspace=${attackerWorkspace.id}, PM_User=${aAuth.user.id}, Tenant_User=${tAuth.user.id}`);

    console.log('\n--- Setup Completed ---');
    console.log('IDs needed for exploit scripts:');
    console.log(JSON.stringify({
      attackerWorkspaceId: attackerWorkspace.id,
      attackerPmId: aAuth.user.id,
      attackerTenantId: tAuth.user.id,
      victimWorkspaceId: victimWorkspace.id,
      victimTenantId: victimTenant.id,
      victimPaymentId: victimPayment.id
    }, null, 2));

  } catch (err) {
    console.error('Setup failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

setup();
