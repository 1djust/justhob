import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workspaceId = '8c74c7ca-12c8-42e6-9e2a-1b54889f84e1';

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      properties: {
        where: { deletedAt: null },
        include: { units: true }
      }
    }
  });

  if (!workspace) {
    console.error('Workspace not found');
    process.exit(1);
  }

  console.log('Workspace:', workspace.name, 'Plan:', workspace.plan);
  console.log('Properties Count:', workspace.properties.length);
  
  let totalUnits = 0;
  workspace.properties.forEach(p => {
    console.log(`- Property: ${p.name}, Units: ${p.units.length}`);
    totalUnits += p.units.length;
  });
  
  console.log('Total Units Count:', totalUnits);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
