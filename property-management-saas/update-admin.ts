import { prisma } from './apps/api/src/lib/database';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), 'apps/api/.env') });

async function updateAdmin() {
  const user = await prisma.user.update({
    where: { email: 'admin@justhob.com' },
    data: { role: 'SUPER_ADMIN' }
  });
  console.log('Updated user role to SUPER_ADMIN:', user.email);
}

updateAdmin().catch(console.error).finally(() => process.exit(0));
