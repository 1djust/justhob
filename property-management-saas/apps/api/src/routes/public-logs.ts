import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

const PublicLogBody = Type.Object({
  message: Type.String(),
  stack: Type.Optional(Type.String()),
  context: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  source: Type.Union([Type.Literal("web"), Type.Literal("mobile")]),
  level: Type.Optional(
    Type.Union([
      Type.Literal("error"),
      Type.Literal("warn"),
      Type.Literal("info"),
    ]),
  ),
});

/**
 * Public Log Ingestion Routes.
 *
 * Allows the Web frontend and Mobile app to report errors to the database.
 */
export default async function publicLogRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  server.post<{ Body: Static<typeof PublicLogBody> }>(
    "/logs",
    {
      schema: { body: PublicLogBody },
    },
    async (request, reply) => {
      try {
        const { message, stack, context, source, level } = request.body;

        if (!message || !source) {
          return reply
            .status(400)
            .send({ error: "Message and source are required" });
        }

        // Payload validation to prevent database exhaustion (DoS)
        if (message.length > 2000) {
          return reply.status(400).send({ error: "Message too long" });
        }
        if (stack && stack.length > 5000) {
          return reply.status(400).send({ error: "Stack trace too long" });
        }

        const log = await prisma.errorLog.create({
          data: {
            level: level || "error",
            message,
            stack,
            source,
            context: {
              ...(context || {}),
              ip: request.ip,
              userAgent: request.headers["user-agent"],
            } as import("@prisma/client").Prisma.InputJsonValue,
          },
        });

        return reply.status(201).send({ success: true, id: log.id });
      } catch (error) {
        fastify.log.error({ err: error }, "Log ingestion failed");
        return reply.status(500).send({ error: "Failed to save log" });
      }
    },
  );
}
