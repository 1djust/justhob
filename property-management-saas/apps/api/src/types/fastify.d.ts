import "fastify";
import type { Server } from "socket.io";

declare module "fastify" {
  interface FastifyInstance {
    io: Server;
  }

  interface FastifyRequest {
    userId?: string;
    userRole?:
      | "OWNER"
      | "MANAGER"
      | "TENANT"
      | "PROPERTY_MANAGER"
      | "LANDLORD"
      | "SUPER_ADMIN";
    globalUserRole?: "SUPER_ADMIN" | "PROPERTY_MANAGER" | "LANDLORD" | "TENANT";
    isAAL2?: boolean;
  }
}
