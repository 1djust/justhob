import { prisma } from './packages/database';

async function main() {
  const landlord = await prisma.user.findUnique({
    where: { email: 'landlord@test.com' },
    include: { workspaces: { include: { workspace: true } } }
  });

  if (!landlord || !landlord.workspaces.length) {
    throw new Error('Landlord or workspace not found');
  }

  const workspaceId = landlord.workspaces[0].workspaceId;
  console.log(`WORKSPACE_ID=${workspaceId}`);
}

main()
  .catch((e) => {
    console.error(e);
    // @ts-ignore
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
