import { FastifyInstance } from "fastify";
import { runAllReminders } from "../cron/registration-reminder";
import { broadcastMobileUpdate } from "../cron/broadcast-mobile-update";
import { timingSafeEqual } from "crypto";

export default async function cronRoutes(fastify: FastifyInstance) {
  // Public/Automated Cron Hook (e.g. for Vercel Cron, GitHub Actions, or Cron-Job.org)
  // Supports both GET and POST requests
  fastify.route({
    method: ["GET", "POST"],
    url: "/reminders",
    schema: {},
    handler: async (request, reply) => {
      const isProd = process.env.NODE_ENV === "production";
      const cronSecret = process.env.CRON_SECRET;

      // In production, enforce CRON_SECRET authentication
      if (isProd && cronSecret) {
        const authHeader = request.headers["authorization"] || "";
        const expectedAuth = `Bearer ${cronSecret}`;

        const authBuffer = Buffer.from(authHeader);
        const expectedBuffer = Buffer.from(expectedAuth);

        if (
          authBuffer.length !== expectedBuffer.length ||
          !timingSafeEqual(authBuffer, expectedBuffer)
        ) {
          fastify.log.warn(
            { ip: request.ip },
            "[CRON/REMINDERS] Unauthorized access attempt to /api/cron/reminders",
          );
          return reply.status(401).send({ error: "Unauthorized" });
        }
      }

      // Parse query and body options (supports ?dryRun=true, ?force=true, etc.)
      const query = (request.query as Record<string, unknown>) || {};
      const body = (request.body as Record<string, unknown>) || {};

      const parseBool = (val: unknown): boolean | undefined => {
        if (typeof val === "boolean") return val;
        if (typeof val === "string") return val.toLowerCase() === "true" || val === "1";
        return undefined;
      };

      const parseNum = (val: unknown): number | undefined => {
        if (typeof val === "number") return val;
        if (typeof val === "string") {
          const parsed = Number(val);
          return isNaN(parsed) ? undefined : parsed;
        }
        return undefined;
      };

      const dryRun = parseBool(body.dryRun ?? query.dryRun) ?? false;
      const force = parseBool(body.force ?? query.force) ?? false;
      const maxAgeDays = parseNum(body.maxAgeDays ?? query.maxAgeDays);
      const minStage1Hours = parseNum(body.minStage1Hours ?? query.minStage1Hours);
      const minStage2Hours = parseNum(body.minStage2Hours ?? query.minStage2Hours);

      fastify.log.info(
        `[CRON/REMINDERS] Automated reminder execution triggered via /api/cron/reminders (dryRun=${dryRun}, force=${force})`,
      );

      try {
        const results = await runAllReminders({
          dryRun,
          force,
          ...(maxAgeDays !== undefined && { maxAgeDays }),
          ...(minStage1Hours !== undefined && { minStage1Hours }),
          ...(minStage2Hours !== undefined && { minStage2Hours }),
          logger: {
            info: (msg) => fastify.log.info(msg),
            warn: (msg) => fastify.log.warn(msg),
            error: (msg, ...args) => {
              if (args.length > 0) fastify.log.error({ err: args[0] }, msg);
              else fastify.log.error(msg);
            },
          },
        });

        return reply.send({
          success: true,
          message: "Automated reminders completed.",
          results,
        });
      } catch (err) {
        fastify.log.error(
          { err },
          "[CRON/REMINDERS] Unhandled error executing reminders via webhook",
        );
        return reply.status(500).send({
          success: false,
          error: (err as Error).message,
        });
      }
    },
  });

  // Mobile App Update Announcement Endpoint
  fastify.route({
    method: ["GET", "POST"],
    url: "/broadcast-mobile-update",
    handler: async (request, reply) => {
      const isProd = process.env.NODE_ENV === "production";
      const cronSecret = process.env.CRON_SECRET;
      const adminKey = process.env.ADMIN_SECURITY_KEY;

      const authHeader = request.headers["authorization"] || "";
      const isAuthorized =
        (!isProd && !cronSecret && !adminKey) ||
        (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
        (adminKey && authHeader === `Bearer ${adminKey}`);

      if (isProd && !isAuthorized) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const query = (request.query as Record<string, unknown>) || {};
      const body = (request.body as Record<string, unknown>) || {};

      const dryRun = body.dryRun === true || query.dryRun === "true";
      const version = (body.version as string) || (query.version as string) || "0.3.5";
      const buildNumber = Number(body.buildNumber ?? query.buildNumber) || 23;

      fastify.log.info(
        `[CRON/BROADCAST] Triggered broadcast mobile update (dryRun=${dryRun}, v${version}+${buildNumber})`,
      );

      try {
        const results = await broadcastMobileUpdate({
          dryRun,
          version,
          buildNumber,
          logger: {
            info: (msg) => fastify.log.info(msg),
            warn: (msg) => fastify.log.warn(msg),
            error: (msg, ...args) => {
              if (args.length > 0) fastify.log.error({ err: args[0] }, msg);
              else fastify.log.error(msg);
            },
          },
        });

        return reply.send({
          success: true,
          message: `Broadcast completed for v${version}+${buildNumber}`,
          results,
        });
      } catch (err) {
        fastify.log.error(
          { err },
          "[CRON/BROADCAST] Error executing broadcast mobile update",
        );
        return reply.status(500).send({
          success: false,
          error: (err as Error).message,
        });
      }
    },
  });
}
