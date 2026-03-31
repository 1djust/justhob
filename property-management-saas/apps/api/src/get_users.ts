import fs from 'fs';
import { PrismaClient } from '@property-management/database';

const prisma = new PrismaClient();

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
  fs.writeFileSync('users_data.json', JSON.stringify(users, null, 2), 'utf-8');
}

main().catch(console.error).finally(() => prisma.$disconnect());
