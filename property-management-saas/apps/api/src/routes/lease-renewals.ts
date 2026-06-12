import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
import {
  authenticate,
  verifyWorkspaceAccess,
  requireManager,
} from "../lib/middleware";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

const WorkspaceParams = Type.Object({ workspaceId: Type.String() });
const RenewalOfferParams = Type.Object({
  workspaceId: Type.String(),
  id: Type.String(),
});
const RenewalOfferBody = Type.Object({
  newRent: Type.Union([Type.String(), Type.Number()]),
  newStartDate: Type.String(),
  newEndDate: Type.String(),
  terms: Type.Optional(Type.String()),
});
const RespondOfferParams = Type.Object({
  workspaceId: Type.String(),
  id: Type.String(),
  offerId: Type.String(),
});
const RespondOfferBody = Type.Object({ accept: Type.Boolean() });

export default async function leaseRenewalRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  server.addHook("preHandler", authenticate);
  server.addHook("preHandler", verifyWorkspaceAccess);

  // List all renewal offers for the workspace
  server.get<{ Params: Static<typeof WorkspaceParams> }>(
    "/leases/renewals",
    {
      schema: { params: WorkspaceParams },
    },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const offers = await prisma.leaseRenewalOffer.findMany({
        where: {
          status: "PENDING",
          lease: {
            tenant: { workspaceId },
          },
        },
        include: {
          lease: {
            include: {
              tenant: { select: { id: true, name: true, email: true } },
              property: { select: { id: true, name: true, address: true } },
            },
          },
        },
        orderBy: { sentAt: "desc" },
      });

      // Map to the shape the frontend expects
      const renewals = offers.map((o) => ({
        id: o.id,
        leaseId: o.leaseId,
        proposedRent: o.newRent,
        proposedStartDate: o.newStartDate,
        proposedEndDate: o.newEndDate,
        terms: o.terms,
        status: o.status,
        sentAt: o.sentAt,
        respondedAt: o.respondedAt,
        initiatedBy: "MANAGER",
        lease: o.lease,
      }));

      return reply.send({ renewals });
    },
  );

  // Manager sends a renewal offer to a tenant
  server.post<{
    Params: Static<typeof RenewalOfferParams>;
    Body: Static<typeof RenewalOfferBody>;
  }>(
    "/leases/:id/renewal-offer",
    {
      preHandler: requireManager,
      schema: { params: RenewalOfferParams, body: RenewalOfferBody },
    },
    async (request, reply) => {
      const { workspaceId, id } = request.params;
      const { newRent, newStartDate, newEndDate, terms } = request.body;

      if (!newRent || !newStartDate || !newEndDate) {
        return reply
          .status(400)
          .send({ error: "New rent amount and dates are required" });
      }

      const lease = await prisma.lease.findUnique({
        where: { id },
        include: { tenant: true },
      });

      if (!lease || lease.tenant.workspaceId !== workspaceId) {
        return reply
          .status(404)
          .send({ error: "Lease not found in this workspace" });
      }

      const existingPending = await prisma.leaseRenewalOffer.findFirst({
        where: { leaseId: id, status: "PENDING" },
      });

      if (existingPending) {
        return reply
          .status(400)
          .send({ error: "A renewal offer is already pending for this lease" });
      }

      const offer = await prisma.leaseRenewalOffer.create({
        data: {
          leaseId: id,
          newRent: Number(newRent),
          newStartDate: new Date(newStartDate),
          newEndDate: new Date(newEndDate),
          terms,
        },
      });

      await prisma.lease.update({
        where: { id },
        data: { status: "PENDING_RENEWAL" },
      });

      // Notify tenant
      const tenantUser = await prisma.user.findUnique({
        where: { email: lease.tenant.email || "" },
      });
      if (tenantUser) {
        const notification = await prisma.notification.create({
          data: {
            userId: tenantUser.id,
            title: "Lease Renewal Offer",
            message: `You have received a new lease renewal offer for ₦${offer.newRent}. Please review and respond.`,
            type: "LEASE_RENEWAL_OFFER",
          },
        });

        // Emit to user room
        (request.server as unknown as { io: import("socket.io").Server }).io
          .to(`user:${tenantUser.id}`)
          .emit("NOTIFICATION_CREATED", notification);
      }

      // Emit real-time update to the workspace
      const room = `workspace:${workspaceId}`;
      console.log(`[LeaseRenewal] Emitting LEASE_UPDATED to room ${room}`);
      (request.server as unknown as { io: import("socket.io").Server }).io
        .to(room)
        .emit("LEASE_UPDATED", { leaseId: id });

      // Targeted emission to the tenant if they are online
      if (tenantUser) {
        const userRoom = `user:${tenantUser.id}`;
        const emailRoom = `user:${lease.tenant.email}`;

        console.log(
          `[LeaseRenewal] Emitting LEASE_RENEWAL_OFFER to rooms: ${userRoom}, ${emailRoom}`,
        );

        (request.server as unknown as { io: import("socket.io").Server }).io
          .to(userRoom)
          .emit("LEASE_RENEWAL_OFFER", {
            leaseId: id,
            offerId: offer.id,
            message: "You have received a new lease renewal offer.",
          });

        if (lease.tenant.email) {
          (request.server as unknown as { io: import("socket.io").Server }).io
            .to(emailRoom)
            .emit("LEASE_RENEWAL_OFFER", {
              leaseId: id,
              offerId: offer.id,
            });
        }
      }

      return reply.status(201).send({ offer });
    },
  );

  // Tenant responds to a renewal offer
  server.put<{
    Params: Static<typeof RespondOfferParams>;
    Body: Static<typeof RespondOfferBody>;
  }>(
    "/leases/:id/renewal-offer/:offerId/respond",
    {
      schema: { params: RespondOfferParams, body: RespondOfferBody },
    },
    async (request, reply) => {
      const { workspaceId, id, offerId } = request.params;
      const { accept } = request.body;

      const offer = await prisma.leaseRenewalOffer.findUnique({
        where: { id: offerId },
        include: { lease: { include: { tenant: true } } },
      });

      if (
        !offer ||
        offer.leaseId !== id ||
        offer.lease.tenant.workspaceId !== workspaceId
      ) {
        return reply.status(404).send({ error: "Offer not found" });
      }

      if (offer.status !== "PENDING") {
        return reply
          .status(400)
          .send({ error: "Offer has already been responded to" });
      }

      const updatedOffer = await prisma.leaseRenewalOffer.update({
        where: { id: offerId },
        data: {
          status: accept ? "ACCEPTED" : "REJECTED",
          respondedAt: new Date(),
        },
      });

      if (accept) {
        // If accepted, we could create a new lease or update the current one
        // Usually, a new lease is created. But for simplicity, we can just update the existing one
        // or keep it PENDING_RENEWAL until the manager finalizes it.
        // Let's create a new lease to keep history
        const newLease = await prisma.lease.create({
          data: {
            tenantId: offer.lease.tenantId,
            propertyId: offer.lease.propertyId,
            unitId: offer.lease.unitId,
            startDate: offer.newStartDate,
            endDate: offer.newEndDate,
            yearlyRent: offer.newRent,
            status: "ACTIVE",
          },
        });

        // Mark old lease as EXPIRED
        await prisma.lease.update({
          where: { id: offer.lease.id },
          data: { status: "EXPIRED" },
        });

        // Notify managers
        const managers = await prisma.workspaceMember.findMany({
          where: {
            workspaceId,
            role: { in: ["PROPERTY_MANAGER", "LANDLORD"] },
          },
        });

        for (const m of managers) {
          await prisma.notification.create({
            data: {
              userId: m.userId,
              title: "Lease Renewal Accepted",
              message: `Tenant ${offer.lease.tenant.name} accepted the lease renewal offer.`,
              type: "LEASE_RENEWED",
            },
          });
        }

        (fastify as unknown as { io: import("socket.io").Server }).io
          .to(`workspace:${workspaceId}`)
          .emit("LEASE_RENEWED", {
            leaseId: newLease.id,
            message: `Tenant ${offer.lease.tenant.name} accepted the lease renewal offer.`,
          });
      } else {
        const otherPendingOffers = await prisma.leaseRenewalOffer.count({
          where: {
            leaseId: offer.lease.id,
            status: "PENDING",
            id: { not: offerId },
          },
        });

        if (otherPendingOffers === 0) {
          await prisma.lease.update({
            where: { id: offer.lease.id },
            data: { status: "ACTIVE" },
          });
        }

        const managers = await prisma.workspaceMember.findMany({
          where: {
            workspaceId,
            role: { in: ["PROPERTY_MANAGER", "LANDLORD"] },
          },
        });

        for (const m of managers) {
          await prisma.notification.create({
            data: {
              userId: m.userId,
              title: "Lease Renewal Rejected",
              message: `Tenant ${offer.lease.tenant.name} rejected the lease renewal offer.`,
              type: "LEASE_RENEWAL_REJECTED",
            },
          });
        }

        (fastify as unknown as { io: import("socket.io").Server }).io
          .to(`workspace:${workspaceId}`)
          .emit("LEASE_RENEWAL_REJECTED", {
            leaseId: offer.lease.id,
            message: `Tenant ${offer.lease.tenant.name} rejected the lease renewal offer.`,
          });
      }

      return reply.send({ offer: updatedOffer });
    },
  );

  // Get all renewal offers for a lease
  server.get<{ Params: Static<typeof RenewalOfferParams> }>(
    "/leases/:id/renewal-offers",
    {
      schema: { params: RenewalOfferParams },
    },
    async (request, reply) => {
      const { workspaceId, id } = request.params;

      const lease = await prisma.lease.findUnique({
        where: { id },
        include: { tenant: true },
      });

      if (!lease || lease.tenant.workspaceId !== workspaceId) {
        return reply
          .status(404)
          .send({ error: "Lease not found in this workspace" });
      }

      const offers = await prisma.leaseRenewalOffer.findMany({
        where: { leaseId: id },
        orderBy: { sentAt: "desc" },
      });

      return reply.send({ offers });
    },
  );
}
