
import { prisma } from './packages/database';

async function main() {
  const email = 'tenant-final@test.com';
  const user = await prisma.user.findUnique({
    where: { email },
    include: { workspaces: { include: { workspace: true } } }
  });
  console.log('USER JSON:', JSON.stringify(user, null, 2));
}
main().finally(() => prisma.$disconnect());
