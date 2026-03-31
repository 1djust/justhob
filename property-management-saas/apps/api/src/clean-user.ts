import { PrismaClient } from '@property-management/database';
const prisma = new PrismaClient();

async function clean() {
  await prisma.user.deleteMany({
    where: { email: 'ogunduyijustus@gmail.com' }
  });
  console.log('Deleted old user');
}
clean().catch(console.error);
