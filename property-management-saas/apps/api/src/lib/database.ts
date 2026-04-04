import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ['error', 'warn'],
  })
}

declare global {
  var prisma: ReturnType<typeof prismaClientSingleton> | undefined
}

const url = process.env.DATABASE_URL || ''
const maskedUrl = url.substring(0, 15).replace(/\s/g, '[SPACE]')
console.log(`[DB] Initialization check: ${maskedUrl}... (Length: ${url.length})`)

export const prisma = (globalThis as any).prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') (globalThis as any).prisma = prisma

export * from '@prisma/client'
