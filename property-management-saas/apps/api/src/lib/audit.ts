import { prisma } from "./database";

export async function logAction({
  userId,
  action,
  entityType,
  entityId,
  details,
  workspaceId,
  ipAddress = "127.0.0.1",
}: {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: string;
  workspaceId?: string;
  ipAddress?: string;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorName: user?.name || "System",
        actorEmail: user?.email || "system@justhob.com",
        action,
        entityType,
        entityId,
        details,
        workspaceId,
        ipAddress,
      },
    });
  } catch (e) {
    console.error("[AuditLog] Failed to log action:", e);
  }
}
