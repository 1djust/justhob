import dotenv from 'dotenv';
const envConfig = dotenv.config({ path: 'packages/database/.env' }).parsed;
if (envConfig && envConfig.DIRECT_URL) {
  process.env.DATABASE_URL = envConfig.DIRECT_URL;
}
import { PrismaClient } from '@prisma/client';
import process from 'node:process';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Checking Free Monitoring System ---');
  
  // 1. Create a "Test Verification Log" if we want to confirm connectivity
  // We already ran this once, but it's safe to run again.
  console.log('Verifying database connectivity...');
  await (prisma as any).errorLog.create({
    data: {
      level: 'info',
      message: 'Monitoring System Verification (TS Fix)',
      source: 'verification-script',
      context: { status: 'active', node: process.version } as any
    }
  });

  // 2. Query the latest logs
  const logs = await (prisma as any).errorLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
  });

  console.log(`\nFound ${logs.length} logs in the database:`);
  logs.forEach((log: any) => {
    const timestamp = log.createdAt instanceof Date ? log.createdAt.toISOString() : log.createdAt;
    console.log(`[${timestamp}] ${log.level.toUpperCase()}: ${log.message} (Source: ${log.source})`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
