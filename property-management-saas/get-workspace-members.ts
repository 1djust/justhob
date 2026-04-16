import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: '8c74c7ca-12c8-42e6-9e2a-1b54889f84e1' },
      include: { user: true }
    });
    console.log(JSON.stringify(members, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
