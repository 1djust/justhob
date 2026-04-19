import 'dotenv/config';
import { prisma } from './lib/database';

async function debug() {
  const email = 'manager@justhob.com';
  console.log(`Checking database state for ${email}...\n`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      workspaces: {
        include: { workspace: true }
      }
    }
  });

  if (!user) {
    console.log('❌ User not found in database.');
    return;
  }

  console.log(`User found: ${user.name || 'No Name'} (${user.id})`);
  console.log(`Total Workspaces: ${user.workspaces.length}\n`);

  for (const mw of user.workspaces) {
    const ws = mw.workspace;
    const propCount = await prisma.property.count({ where: { workspaceId: ws.id, deletedAt: null } });
    const unitCount = await prisma.unit.count({ where: { workspaceId: ws.id } });
    const tenantCount = await prisma.tenant.count({ where: { workspaceId: ws.id, deletedAt: null } });

    console.log(`--- Workspace: "${ws.name}" ---`);
    console.log(`ID: ${ws.id}`);
    console.log(`Role: ${mw.role}`);
    console.log(`Plan: ${ws.plan}`);
    console.log(`Properties: ${propCount}`);
    console.log(`Units: ${unitCount}`);
    console.log(`Tenants: ${tenantCount}`);
    console.log('------------------------------\n');
  }
}

debug().catch(console.error).finally(() => process.exit());
