
import { prisma } from './packages/database';
import bcrypt from 'bcryptjs';

async function main() {
  const email = 'tenant-final@test.com';
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    console.log('User not found');
    return;
  }

  console.log('User Found:', user.id, user.email);
  const passMatch = await bcrypt.compare('password123', user.password);
  console.log('Password "password123" match:', passMatch);
  
  const workspaces = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    include: { workspace: true }
  });
  console.log('Workspaces:', workspaces.map(w => ({ name: w.workspace.name, role: w.role })));
}

main().finally(() => prisma.$disconnect());
