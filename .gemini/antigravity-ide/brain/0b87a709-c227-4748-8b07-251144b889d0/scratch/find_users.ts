import { PrismaClient } from "@prisma/client";

async function run() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true
      }
    });
    console.log("Users in Database:");
    console.log(JSON.stringify(users, null, 2));
  } catch (err: any) {
    console.error("Prisma query failed:", err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
