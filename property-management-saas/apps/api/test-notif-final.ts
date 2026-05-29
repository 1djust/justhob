import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.gushvedprjygyauwzvnf:1%40ActionSupabase@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    }
  }
});

async function run() {
  const email = 'omolola.iseyemi@example.com';
  const tenant = await prisma.user.findUnique({ where: { email } });
  if (!tenant) throw new Error("tenant not found");

  console.log('Testing notifications for:', email);
  
  const notifs = await prisma.notification.findMany({
    where: { userId: tenant.id },
    orderBy: { createdAt: 'desc' }
  });

  console.log('Total notifications:', notifs.length);
  const unread = notifs.filter(n => !n.isRead);
  console.log('Unread count:', unread.length);

  if (unread.length > 0) {
    console.log('Latest unread notification:', unread[0].id);
    const updated = await prisma.notification.update({
      where: { id: unread[0].id },
      data: { isRead: true }
    });
    console.log('Update successful, isRead is now:', updated.isRead);
  } else {
    console.log('No unread notifications. Creating a fresh one...');
    const fresh = await prisma.notification.create({
      data: {
        userId: tenant.id,
        title: 'Lease Renewal Offer',
        message: 'Fresh offer for test',
        type: 'LEASE_RENEWAL_OFFER',
        isRead: false
      }
    });
    console.log('Created fresh unread notification:', fresh.id);
  }
}

run().catch(console.error).finally(() => process.exit(0));
