import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ['error', 'warn'],
  })
}

declare global {
  var prisma: ReturnType<typeof prismaClientSingleton> | undefined
}

export const prisma = (globalThis as any).prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') (globalThis as any).prisma = prisma

export * from '@prisma/client'
