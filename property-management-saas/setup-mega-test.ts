import * as dotenv from 'dotenv';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env before initializing Prisma
dotenv.config({ path: join(process.cwd(), 'apps/api/.env') });
dotenv.config({ path: join(process.cwd(), '.env') }); // Fallback

// We import prisma dynamically or require it so that the environment variables are loaded FIRST
const { prisma } = require('./apps/api/src/lib/database');

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupMegaScenario() {
  console.log('🚀 Setting up Mega Lifecycle Scenario...');

  const password = 'Test1234!';
  const usersToSetup = [
    'tenant@justhob.com',
    'admin@justhob.com',
    'manager@justhob.com'
  ];

  const scenarioArg = process.argv[2];
  if (!scenarioArg || !['90', '60', '30', '7', '1'].includes(scenarioArg)) {
    console.error('❌ Please provide a valid scenario argument: 90, 60, 30, 7, or 1');
    console.log('Example: npx tsx setup-mega-test.ts 90');
    process.exit(1);
  }
  const scenario = parseInt(scenarioArg, 10);


  // 1. Ensure Supabase Auth is ready for all test users
  console.log('🔑 Syncing Supabase passwords...');
  const { data: { users } } = await supabase.auth.admin.listUsers();
  for (const email of usersToSetup) {
    const user = users.find(u => u.email === email);
    if (user) {
      await supabase.auth.admin.updateUserById(user.id, { password });
    } else {
      await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    }
  }

  // 2. Setup Lease Expiry Milestones
  const setupLease = async (email: string, daysOffset: number) => {
    const tenant = await prisma.tenant.findFirst({
      where: { email },
      include: { leases: true }
    });
    if (tenant && tenant.leases.length > 0) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysOffset);
      targetDate.setHours(0, 0, 0, 0);
      await prisma.lease.update({
        where: { id: tenant.leases[0].id },
        data: { status: 'ACTIVE', endDate: targetDate }
      });
      console.log(`📅 ${email}: Set to expire in ${daysOffset} days.`);
    }
  };

  const tenantEmail = 'tenant@justhob.com';
  
  if (scenario === 90 || scenario === 60 || scenario === 30) {
    await setupLease(tenantEmail, scenario);
  } else if (scenario === 1) {
    // 1 day overdue
    const overdueTenant = await prisma.tenant.findFirst({
      where: { email: tenantEmail },
      include: { leases: true }
    });
    if (overdueTenant && overdueTenant.leases.length > 0) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const payment = await prisma.payment.findFirst({
        where: { leaseId: overdueTenant.leases[0].id }
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'PENDING', dueDate: yesterday }
        });
        console.log(`💸 ${tenantEmail}: Set payment to 1 day overdue.`);
      }
    }
  } else if (scenario === 7) {
    // 7 days pre-due
    const predueTenant = await prisma.tenant.findFirst({
      where: { email: tenantEmail },
      include: { leases: true }
    });
    if (predueTenant && predueTenant.leases.length > 0) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(0, 0, 0, 0);

      await prisma.payment.create({
        data: {
          leaseId: predueTenant.leases[0].id,
          workspaceId: predueTenant.workspaceId,
          amount: 50000,
          status: 'PENDING',
          dueDate: nextWeek,
          note: 'Upcoming Rent'
        }
      });
      console.log(`💰 ${tenantEmail}: Created payment due in 7 days.`);
    }
  }

  console.log('\n✨ All scenarios ready!');
  
  // 5. Update Landlord/Manager bank details for the Payment Account card
  const managerUser = await prisma.user.findUnique({ where: { email: 'manager@justhob.com' } });
  const tenant = await prisma.tenant.findFirst({ where: { email: 'tenant@justhob.com' } });
  
  if (managerUser && tenant) {
    await prisma.workspaceMember.update({
      where: {
        userId_workspaceId: {
          userId: managerUser.id,
          workspaceId: tenant.workspaceId
        }
      },
      data: {
        bankCode: '044', // Access Bank
        accountNumber: '1234567890',
        accountName: 'Just Hub Property Management'
      }
    });
    console.log('✅ Landlord bank details updated (Just Hub Property Management)');
  }

  console.log('👉 Click "Run System Jobs Now" to trigger all notifications.');
}

setupMegaScenario().catch(console.error).finally(() => process.exit(0));
