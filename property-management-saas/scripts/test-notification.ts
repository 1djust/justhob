import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No user found to test notification.');
    return;
  }

  console.log('Testing Notification creation for user:', user.email);
  
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Test Notification',
        message: 'This is a test to verify the Notification model.',
        type: 'TEST'
      }
    });
    console.log('Success:', JSON.stringify(notification, null, 2));
    
    // Test fetch
    const list = await prisma.notification.findMany({ where: { userId: user.id } });
    console.log('Found:', list.length, 'notifications');

  } catch (e: any) {
    console.error('FAILED to create/access Notification:', e.message);
    if (e.code === 'P2021') {
      console.error('The table Notification does not exist in the database.');
    }
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
