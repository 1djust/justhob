import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const prisma = new PrismaClient();

const TEST_EMAILS = [
  'attacker@sec-test.com',
  'victim@sec-test.com',
  'attacker-tenant@sec-test.com',
  'v-tenant@sec-test.com',
  'pwned@attacker.com'
];

async function teardown() {
  console.log('--- Cleaning Up Security Test Data ---');

  try {
    // 1. Find the test workspaces
    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { name: 'SEC_TEST_VICTIM_WS' },
          { name: 'SEC_TEST_ATTACKER_WS' }
        ]
      }
    });

    const workspaceIds = workspaces.map(w => w.id);

    if (workspaceIds.length > 0) {
      console.log(`Deleting data for workspaces: ${workspaceIds.join(', ')}`);
      
      // Cascading deletes handled by schema, but let's be thorough with non-cascading relations if any
      // The schema has onDelete: Cascade for Workspace -> Property, Unit, Tenant, etc.
      
      for (const id of workspaceIds) {
        await prisma.workspace.delete({ where: { id } });
      }
      console.log('Workspaces and related records (Properties, Tenants, Payments, Members) deleted.');
    }

    // 2. Delete Supabase Users
    console.log('Cleaning up Supabase Auth users...');
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const usersToDelete = users.filter(u => TEST_EMAILS.includes(u.email!));

    for (const u of usersToDelete) {
      await supabase.auth.admin.deleteUser(u.id);
      console.log(`Deleted Supabase user: ${u.email}`);
      
      // Also delete from Prisma User table
      try {
        await prisma.user.delete({ where: { id: u.id } });
      } catch (e) { /* Already deleted by cascade or didn't exist */ }
    }

    console.log('\n--- Teardown Completed Successfully ---');

  } catch (err) {
    console.error('Teardown failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

teardown();
