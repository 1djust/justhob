import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Please provide an email');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      workspaces: {
        include: { workspace: true }
      }
    }
  });

  if (!user) {
    console.error(`User with email ${email} not found`);
    process.exit(1);
  }

  console.log('User Found:', {
    id: user.id,
    email: user.email,
    name: user.name
  });

  if (user.workspaces.length === 0) {
    console.log('No workspaces found for this user');
  } else {
    console.log('Workspaces:');
    user.workspaces.forEach((wm, i) => {
      console.log(`${i + 1}. Workspace: ${wm.workspace.name}`);
      console.log(`   ID: ${wm.workspace.id}`);
      console.log(`   Plan: ${wm.workspace.plan}`);
      console.log(`   Role: ${wm.role}`);
    });
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
