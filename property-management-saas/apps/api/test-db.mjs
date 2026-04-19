import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const start = Date.now();
    console.log('Connecting to database...');
    const count = await prisma.user.count();
    console.log(`Connection successful! Found ${count} users in ${Date.now() - start}ms`);
  } catch (e) {
    console.error('Database connection failed:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
