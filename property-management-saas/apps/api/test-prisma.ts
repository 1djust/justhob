import { PrismaClient } from '@prisma/client';
const dbUrl = 'postgresql://postgres.gushvedprjygyauwzvnf:1%40ActionSupabase@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require&pgbouncer=true';
const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
  log: ['info', 'query', 'warn', 'error'],
});
async function main() {
  try {
    console.log('Connecting...');
    await prisma.$connect();
    console.log('Connected!');
    const users = await prisma.user.findMany({ take: 1 });
    console.log('Query OK:', users.length);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
