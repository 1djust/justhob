import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.gushvedprjygyauwzvnf:1%40ActionSupabase@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    }
  }
});

async function run() {
  console.log('Connecting to database...');
  try {
    const count = await prisma.notification.count({ where: { isRead: false } });
    console.log('UNREAD_COUNT_BEFORE:', count);
    
    const updateResult = await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true }
    });
    console.log('UPDATE_RESULT:', updateResult);
    
    const countAfter = await prisma.notification.count({ where: { isRead: false } });
    console.log('UNREAD_COUNT_AFTER:', countAfter);
  } catch (err) {
    console.error('DATABASE_ERROR:', err);
  }
}
run().finally(() => process.exit(0));
