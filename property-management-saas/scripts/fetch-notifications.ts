import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No user found');
    return;
  }
  
  console.log('Fetching notifications for user:', user.email);
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    console.log('Success, found:', notifications.length);
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
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
