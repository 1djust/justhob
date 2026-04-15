import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workspaceId = '8c74c7ca-12c8-42e6-9e2a-1b54889f84e1';
  
  // Try to create a second property
  const name = 'Test Second Property';
  const address = 'Test Address';
  
  // REPRODUCING THE CHECK LOGIC FROM API
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  console.log('Workspace Plan:', workspace?.plan);
  
  if (workspace?.plan === 'FREE') {
    const propertiesCount = await prisma.property.count({
      where: { workspaceId, deletedAt: null }
    });
    console.log('Current Properties Count:', propertiesCount);
    
    if (propertiesCount >= 1) {
      console.log('SUCCESSFUL REPRODUCTION: Limit reached (properties >= 1)');
      // return reply.status(402).send({ error: '...' });
    } else {
      console.log('FAILURE: Limit check passed incorrectly');
    }
  } else {
    console.log('FAILURE: Workspace is not in FREE plan or not found');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
