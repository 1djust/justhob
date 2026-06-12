import { FastifyInstance, FastifyPluginAsync } from "fastify";
import fastifySocketIO from "fastify-socket.io";
import fp from "fastify-plugin";
import { Server, Socket } from "socket.io";
import { supabaseAdmin } from "../lib/supabase";
import { prisma } from "../lib/database";

declare module "fastify" {
  interface FastifyInstance {
    io: Server;
  }
}

const socketPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const allowedOrigins = [
    "http://localhost:3000",
    "https://justhob.vercel.app",
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  fastify.register(fastifySocketIO, {
    cors: {
      origin: allowedOrigins, // Restricted to known frontend domains
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  fastify.ready((err) => {
    if (err) throw err;

    fastify.io.on("connection", async (socket: Socket) => {
      // Authenticate socket connection
      const token = socket.handshake.auth.token;

      if (!token) {
        console.log("[Socket] Disconnected: Missing token");
        socket.disconnect();
        return;
      }

      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) {
        console.log("[Socket] Disconnected: Invalid token");
        socket.disconnect();
        return;
      }

      const userId = data.user.id;
      const userEmail = data.user.email;
      console.log(
        `[Socket] User connected: ${userId} (${userEmail}) - Socket: ${socket.id}`,
      );

      // Join user-specific rooms for direct notifications
      socket.join(`user:${userId}`);
      if (userEmail) {
        socket.join(`user:${userEmail}`);
        console.log(`[Socket] ${userId} joined room user:${userEmail}`);
      }
      console.log(`[Socket] ${userId} joined personal room user:${userId}`);

      // Allow users to join workspace-specific rooms
      socket.on("join-workspace", async (workspaceId: string) => {
        try {
          // Verify workspace membership (Manager/Landlord)
          let isAuthorized = false;

          const membership = await prisma.workspaceMember.findFirst({
            where: { workspaceId, userId: userId },
          });

          if (membership) {
            isAuthorized = true;
          } else {
            // Check if user is a tenant in this workspace
            const userEmail = data.user.email;
            if (userEmail) {
              const tenant = await prisma.tenant.findFirst({
                where: { workspaceId, email: userEmail, deletedAt: null },
              });
              if (tenant) {
                isAuthorized = true;
                console.log(
                  `[Socket] ${userId} authorized as tenant for workspace:${workspaceId}`,
                );
              }
            }
          }

          if (!isAuthorized) {
            console.warn(
              `[Socket] Forbidden: ${userId} tried to join workspace:${workspaceId} (Unauthorized)`,
            );
            socket.emit("error", {
              message: "Forbidden: You are not a member of this workspace",
            });
            return;
          }

          socket.join(`workspace:${workspaceId}`);
          console.log(
            `[Socket] Auth Success: ${userId} joined room workspace:${workspaceId}`,
          );
          socket.emit("joined-workspace", { workspaceId });
        } catch (error) {
          console.error("[Socket] Error in join-workspace:", error);
          socket.emit("error", {
            message: "Internal server error during room join",
          });
        }
      });

      socket.on("leave-workspace", (workspaceId: string) => {
        socket.leave(`workspace:${workspaceId}`);
      });

      // Join a specific maintenance request room for chat
      socket.on(
        "join-maintenance",
        async ({
          workspaceId,
          requestId,
        }: {
          workspaceId: string;
          requestId: string;
        }) => {
          try {
            // Verify workspace membership first
            const membership = await prisma.workspaceMember.findFirst({
              where: { workspaceId, userId },
            });

            if (!membership) {
              socket.emit("error", {
                message: "Forbidden: You are not a member of this workspace",
              });
              return;
            }

            socket.join(`maintenance:${requestId}`);
            console.log(
              `[Socket] User ${userId} joined room maintenance:${requestId}`,
            );
          } catch (error) {
            console.error("[Socket] Error in join-maintenance:", error);
          }
        },
      );

      socket.on("leave-maintenance", (requestId: string) => {
        socket.leave(`maintenance:${requestId}`);
      });

      socket.on("disconnect", () => {
        console.log(`[Socket] User disconnected: ${userId}`);
      });
    });
  });
};

export default fp(socketPlugin);
