import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "./database";
import { supabaseAdmin } from "./supabase";

// Shared authenticate middleware — verifies Supabase JWT and attaches userId and globalRole
export const authenticate = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const token = request.headers.authorization?.replace("Bearer ", "");
  if (!token) return reply.status(401).send({ error: "Unauthorized" });

  // Verify the token via Supabase Auth — fail closed if verification fails for any reason
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return reply.status(401).send({ error: "Invalid or expired token" });
  }

  const userId = data.user.id;

  // Attach platform-level user data
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  });

  if (!dbUser) {
    return reply.status(401).send({ error: "User setup incomplete" });
  }

  // Security: Reject banned users even if their JWT is still valid
  if (dbUser.isActive === false) {
    return reply
      .status(403)
      .send({ error: "Account has been deactivated. Contact support." });
  }

  request.userId = dbUser.id;
  request.globalUserRole = dbUser.role as
    | "SUPER_ADMIN"
    | "PROPERTY_MANAGER"
    | "LANDLORD"
    | "TENANT";

  // Parse AAL status for Super Admins to use in requireSuperAdmin
  request.isAAL2 = false;
  if (dbUser.role === "SUPER_ADMIN") {
    try {
      const payloadBase64Url = token.split(".")[1];
      if (payloadBase64Url) {
        const payloadBase64 = payloadBase64Url
          .replace(/-/g, "+")
          .replace(/_/g, "/");
        const payloadStr = Buffer.from(payloadBase64, "base64").toString(
          "utf8",
        );
        const payload = JSON.parse(payloadStr);
        request.isAAL2 = payload.aal === "aal2";
      }
    } catch (e) {
      // Invalid token structure, leave as false
    }
  }
};

// Middleware to require SUPER_ADMIN role platform-wide
export const requireSuperAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (request.globalUserRole !== "SUPER_ADMIN") {
    return reply.status(403).send({ error: "Super Admin privileges required" });
  }

  // Security: Enforce Two-Factor Authentication (AAL2) for Super Admins
  // This blocks access to God Mode routes if they haven't verified 2FA.
  if (!request.isAAL2) {
    return reply.status(403).send({
      error:
        "Multi-Factor Authentication required. Please complete 2FA setup or verification.",
      code: "MFA_REQUIRED",
    });
  }
};

// Verify workspace access and attach role
export const verifyWorkspaceAccess = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const userId = request.userId!;
  const { workspaceId } = request.params as { workspaceId: string };

  if (!workspaceId)
    return reply.status(400).send({ error: "Workspace ID required" });

  const member = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });

  if (!member) return reply.status(403).send({ error: "Forbidden" });
  request.userRole! = member.role;
};

// Middleware to require PROPERTY_MANAGER role
export const requireManager = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const userRole = request.userRole!;
  if (userRole !== "PROPERTY_MANAGER") {
    return reply
      .status(403)
      .send({ error: "Only property managers can perform this action" });
  }
};

// Middleware to require either PROPERTY_MANAGER or LANDLORD role
export const requireManagement = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const userRole = request.userRole!;
  if (userRole !== "PROPERTY_MANAGER" && userRole !== "LANDLORD") {
    return reply.status(403).send({ error: "Management role required" });
  }
};
