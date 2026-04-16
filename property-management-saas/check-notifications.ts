import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: '2cc3aa38-6fe2-4f70-ad64-8109a4fa2b35' },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    console.log('--- NOTIFICATIONS FOR MANAGER ---');
    console.log(JSON.stringify(notifications, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
