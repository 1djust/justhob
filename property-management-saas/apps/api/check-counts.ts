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
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { isActive: true } });
    const totalWorkspaces = await prisma.workspace.count();
    const activeWorkspaces = await prisma.workspace.count({
      where: { status: "ACTIVE" },
    });
    const totalProperties = await prisma.property.count({
      where: { deletedAt: null },
    });
    const totalUnits = await prisma.unit.count();
    const totalLeases = await prisma.lease.count();
    const activeLeases = await prisma.lease.count({
      where: { status: "ACTIVE" },
    });

    const paidSum = await prisma.payment.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    });

    const pendingCount = await prisma.payment.count({
      where: { status: "PENDING" },
    });
    const overdueCount = await prisma.payment.count({
      where: { status: "OVERDUE" },
    });
    const bannedUsers = await prisma.user.count({ where: { isActive: false } });
    const totalErrorLogs = await prisma.errorLog.count();

    console.log("DATABASE COUNTS:");
    console.log("Total Users:", totalUsers, "Active Users:", activeUsers);
    console.log(
      "Total Workspaces:",
      totalWorkspaces,
      "Active Workspaces:",
      activeWorkspaces,
    );
    console.log(
      "Total Properties:",
      totalProperties,
      "Total Units:",
      totalUnits,
    );
    console.log("Total Leases:", totalLeases, "Active Leases:", activeLeases);
    console.log(
      "Paid Revenue Sum:",
      paidSum._sum.amount || 0,
      "Pending Payments:",
      pendingCount,
      "Overdue Payments:",
      overdueCount,
    );
    console.log("Banned Users:", bannedUsers);
    console.log("Error Logs:", totalErrorLogs);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
