
import { prisma } from './packages/database';
import jwt from 'jsonwebtoken';

async function main() {
  const email = 'tenant-final@test.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('User not found');
  const token = jwt.sign({ userId: user.id }, 'just-hub-secret-key-2024');
  console.log('TOKEN:', token);
}
main().finally(() => prisma.$disconnect());
