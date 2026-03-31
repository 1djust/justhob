
import { prisma } from './packages/database';

async function main() {
  const users = await prisma.user.findMany({
    include: {
      workspaces: {
        include: {
          workspace: true
        }
      }
    }
  });

  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
