import { PrismaClient } from '@prisma/client'

// WSL FIX: Force-rebuild DATABASE_URL with sslmode=disable before Prisma reads it.
// Prisma's Rust engine has SSL compatibility issues with Supabase pooler in WSL dev.
// We strip any existing sslmode/pgbouncer params and re-add clean ones.
// IMPORTANT: We also patch DIRECT_URL (not delete it) because schema.prisma references
// directUrl = env("DIRECT_URL") — deleting it causes PrismaClientInitializationError.
const _patchUrl = (raw: string) => {
  if (!raw) return raw;
  const clean = raw
    .replace(/[?&]sslmode=[^&]*/g, '')
    .replace(/[?&]pgbouncer=[^&]*/g, '');
  const sep = clean.includes('?') ? '&' : '?';
  return clean + sep + 'sslmode=require&pgbouncer=true';
};

const _patchedDbUrl = _patchUrl(process.env.DATABASE_URL ?? '');
if (_patchedDbUrl) {
  process.env.DATABASE_URL = _patchedDbUrl;
  // Keep DIRECT_URL in sync — Prisma requires it (schema has directUrl = env("DIRECT_URL"))
  process.env.DIRECT_URL = _patchedDbUrl;
}

console.log('PRISMA_DB_URL_DEV_PATCH:', _patchedDbUrl);

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ['error', 'warn'],
    // Pass URL explicitly via datasources to bypass any env-var timing issues
    datasources: { db: { url: _patchedDbUrl } },
  })
}

declare global {
  var prisma: ReturnType<typeof prismaClientSingleton> | undefined
}

export const prisma = (globalThis as unknown as { prisma: ReturnType<typeof prismaClientSingleton> }).prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') (globalThis as unknown as { prisma: ReturnType<typeof prismaClientSingleton> }).prisma = prisma

export * from '@prisma/client'
