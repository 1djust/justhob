import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "./database";
import { supabaseAdmin } from "./supabase";

// In-memory cache to store auth and workspace access checks over high-latency WAN connections
interface CachedAuth {
  userId: string;
  globalUserRole: "SUPER_ADMIN" | "PROPERTY_MANAGER" | "LANDLORD" | "TENANT";
  isAAL2: boolean;
  isAdminVerified?: boolean;
  expiresAt: number;
}

export const authCache = new Map<string, CachedAuth>();
export const verifiedAdminTokens = new Map<string, number>();

interface CachedWorkspaceAccess {
  role: string;
  expiresAt: number;
}

const workspaceAccessCache = new Map<string, CachedWorkspaceAccess>();

// Periodic garbage collection to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of authCache.entries()) {
    if (entry.expiresAt < now) authCache.delete(token);
  }
  for (const [key, entry] of workspaceAccessCache.entries()) {
    if (entry.expiresAt < now) workspaceAccessCache.delete(key);
  }
  for (const [token, expiresAt] of verifiedAdminTokens.entries()) {
    if (expiresAt < now) verifiedAdminTokens.delete(token);
  }
}, 5 * 60 * 1000).unref();

// Shared authenticate middleware — verifies Supabase JWT and attaches userId and globalRole
export const authenticate = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const token = request.headers.authorization?.replace("Bearer ", "");
  if (!token) return reply.status(401).send({ error: "Unauthorized" });

  const now = Date.now();
  const cached = authCache.get(token);
  if (cached && cached.expiresAt > now) {
    if (cached.globalUserRole === "SUPER_ADMIN" && !cached.isAdminVerified) {
      const isVerifyRoute = request.raw.url?.endsWith("/verify");
      if (!isVerifyRoute) {
        return reply.status(401).send({
          error: "Admin Security Key verification required.",
          code: "ADMIN_KEY_REQUIRED",
        });
      }
    }
    request.userId = cached.userId;
    request.globalUserRole = cached.globalUserRole;
    request.isAAL2 = cached.isAAL2;
    return;
  }

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

  // Parse AAL status for Super Admins
  let isAAL2 = false;
  let isAdminVerified = false;
  if (dbUser.role === "SUPER_ADMIN") {
    isAdminVerified = verifiedAdminTokens.has(token);
    const isVerifyRoute = request.raw.url?.endsWith("/verify");
    if (!isAdminVerified && !isVerifyRoute) {
      return reply.status(401).send({
        error: "Admin Security Key verification required.",
        code: "ADMIN_KEY_REQUIRED",
      });
    }

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
        isAAL2 = payload.aal === "aal2";
      }
    } catch (e) {
      // Invalid token structure, leave as false
    }
  }

  request.userId = dbUser.id;
  request.globalUserRole = dbUser.role as any;
  request.isAAL2 = isAAL2;

  // Cache authentication for 60 seconds
  authCache.set(token, {
    userId: dbUser.id,
    globalUserRole: dbUser.role as any,
    isAAL2,
    isAdminVerified,
    expiresAt: now + 60 * 1000,
  });
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
  // In development/test environments, we bypass this check to simplify testing.
  if (process.env.NODE_ENV === "production" && !request.isAAL2) {
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

  const cacheKey = `${userId}:${workspaceId}`;
  const now = Date.now();
  const cached = workspaceAccessCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    request.userRole = cached.role as any;
    return;
  }

  const member = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });

  if (!member) return reply.status(403).send({ error: "Forbidden" });
  request.userRole = member.role as any;

  // Cache workspace access role for 60 seconds
  workspaceAccessCache.set(cacheKey, {
    role: member.role,
    expiresAt: now + 60 * 1000,
  });
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
