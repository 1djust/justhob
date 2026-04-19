import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function upgradeAll() {
  const email = 'manager@justhob.com';
  console.log(`Upgrading ALL workspaces for ${email}...`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { workspaces: true }
  });

  if (!user || user.workspaces.length === 0) {
    console.error('❌ User not found.');
    return;
  }

  for (const mw of user.workspaces) {
    await prisma.workspace.update({
      where: { id: mw.workspaceId },
      data: { plan: 'PRO' }
    });
    console.log(`✅ Upgraded workspace ${mw.workspaceId} to PRO`);
  }

  console.log('\n✨ All workspaces for manager are now PRO.');
}

upgradeAll().catch(console.error).finally(() => process.exit());
