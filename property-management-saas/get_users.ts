import { prisma } from './packages/database';

async function main() {
  const users = await prisma.user.findMany({
    take: 10,
    select: {
      id: true,
      email: true,
      name: true,
      workspaces: {
        select: {
          role: true,
          workspace: { select: { name: true } }
        }
      }
    }
  });

  console.log("Found Users:");
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
