import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
import { authenticate } from "../lib/middleware";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

const NotificationParams = Type.Object({ id: Type.String() });

export default async function notificationRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  server.addHook("preHandler", authenticate);

  // Get notifications for the user
  server.get("/", { schema: {} }, async (request, reply) => {
    try {
      const userId = request.userId!;

      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return reply.send({ notifications });
    } catch (error: unknown) {
      request.log.error({ err: error }, "[GetNotificationsError]");
      return reply.status(500).send({
        error: "Failed to fetch notifications: " + (error as Error).message,
      });
    }
  });

  // Mark all as read
  server.patch("/read-all", { schema: {} }, async (request, reply) => {
    const userId = request.userId!;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return reply.send({ success: true });
  });

  // Mark single as read
  server.patch<{ Params: Static<typeof NotificationParams> }>(
    "/:id/read",
    {
      schema: { params: NotificationParams },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const { id } = request.params;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });
      if (!notification)
        return reply.status(404).send({ error: "Notification not found" });
      if (notification.userId !== userId)
        return reply.status(403).send({ error: "Unauthorized" });

      await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });

      return reply.send({ success: true });
    },
  );
}
