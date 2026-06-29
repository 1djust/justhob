import "dotenv/config";
import dns from "dns/promises";

async function main() {
  const host = "aws-1-eu-north-1.pooler.supabase.com";
  try {
    const ips = await dns.resolve4(host);
    if (ips && ips.length > 0) {
      const ip = ips[0];
      if (process.env.DATABASE_URL) {
        process.env.DATABASE_URL = process.env.DATABASE_URL.replace(host, ip);
      }
      if (process.env.DIRECT_URL) {
        process.env.DIRECT_URL = process.env.DIRECT_URL.replace(host, ip);
      }
    }
  } catch (err) {}

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DIRECT_URL || process.env.DATABASE_URL,
      },
    },
  });

  try {
    console.log("Querying PROPERTY_MANAGERs with workspaces...");
    const users = await prisma.user.findMany({
      where: {
        role: "PROPERTY_MANAGER",
        workspaces: {
          some: {
            role: "PROPERTY_MANAGER",
          },
        },
      },
      select: {
        email: true,
        name: true,
        role: true,
        workspaces: {
          select: {
            workspace: {
              select: { name: true },
            },
          },
        },
      },
    });

    console.log(`Found ${users.length} users:`);
    users.forEach((u) => {
      console.log(
        u.email,
        u.name,
        "WS:",
        u.workspaces.map((w) => w.workspace.name),
      );
    });
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
