import { describe, it, expect, beforeAll } from "vitest";
import dns from "dns/promises";
import crypto from "crypto";

// Resolve DB hostname to IPv4 BEFORE importing app/prisma (mirrors index.ts logic)
const DB_HOST = "aws-1-eu-north-1.pooler.supabase.com";
try {
  const ips = await dns.resolve4(DB_HOST);
  if (ips && ips.length > 0) {
    const dbIp = ips.includes("51.21.18.29") ? "51.21.18.29" : ips[0];
    const directIp = ips.includes("51.21.189.77") ? "51.21.189.77" : ips[0];

    if (process.env.DATABASE_URL) {
      process.env.DATABASE_URL = process.env.DATABASE_URL.replace(DB_HOST, dbIp);
    }
    if (process.env.DIRECT_URL) {
      process.env.DIRECT_URL = process.env.DIRECT_URL.replace(DB_HOST, directIp);
    }
  }
} catch (err) {
  // Fall through to default env URL
}

const { app } = await import("../src/app");
const { prisma } = await import("../src/lib/database");

describe("Priority 9: Webhook Cryptographic Security & Idempotency", () => {
  let workspaceId: string;
  let propertyId: string;
  let tenantId: string;
  let leaseId: string;
  let paymentId: string;
  const paystackSecret = "sk_test_mock_paystack_secret_key_12345";
  const testRef = `paystack_ref_${Date.now()}`;

  beforeAll(async () => {
    process.env.PAYSTACK_SECRET_KEY = paystackSecret;

    // Create workspace, property, tenant, lease, and pending payment
    const ws = await prisma.workspace.create({
      data: { name: "Webhook Security Workspace", plan: "PRO" },
    });
    workspaceId = ws.id;

    const prop = await prisma.property.create({
      data: { name: "Webhook House", address: "100 Webhook Lane", workspaceId },
    });
    propertyId = prop.id;

    const unit = await prisma.unit.create({
      data: { unitNumber: "W-1", type: "MINI_FLAT", propertyId, workspaceId },
    });

    const tenant = await prisma.tenant.create({
      data: {
        name: "Webhook Tenant",
        email: `tenant_wh_${Date.now()}@test.com`,
        phone: "+2348000000000",
        workspaceId,
      },
    });
    tenantId = tenant.id;

    const lease = await prisma.lease.create({
      data: {
        propertyId,
        unitId: unit.id,
        tenantId,
        yearlyRent: 150000,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    leaseId = lease.id;

    const payment = await prisma.payment.create({
      data: {
        workspaceId,
        leaseId,
        amount: 150000,
        dueDate: new Date(),
        status: "PENDING",
        transactionId: testRef,
      },
    });
    paymentId = payment.id;
  });

  describe("HMAC SHA512 Signature Verification", () => {
    it("rejects webhook with missing signature header with 401", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/public/webhooks/paystack",
        payload: { event: "charge.success", data: { reference: testRef } },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ error: "Unauthorized" });
    });

    it("rejects webhook with invalid/forged signature with 401", async () => {
      const payload = { event: "charge.success", data: { reference: testRef } };
      const res = await app.inject({
        method: "POST",
        url: "/api/public/webhooks/paystack",
        headers: {
          "x-paystack-signature": "invalid_forged_signature_hash_value_1234567890",
        },
        payload,
      });

      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ error: "Invalid signature" });
    });
  });

  describe("Successful Settlement & Atomic Idempotency", () => {
    it("successfully settles payment when valid HMAC SHA-512 signature is provided", async () => {
      const payload = {
        event: "charge.success",
        data: {
          reference: testRef,
          amount: 15000000, // in kobo
          channel: "card",
          status: "success",
        },
      };

      const rawBody = JSON.stringify(payload);
      const validSignature = crypto
        .createHmac("sha512", paystackSecret)
        .update(rawBody)
        .digest("hex");

      const res = await app.inject({
        method: "POST",
        url: "/api/public/webhooks/paystack",
        headers: {
          "x-paystack-signature": validSignature,
        },
        payload,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      // Verify payment was marked as PAID in database
      const updatedPayment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });
      expect(updatedPayment?.status).toBe("PAID");
      expect(updatedPayment?.amountPaid).toBe(150000);

      // Verify payment transaction record was created
      const tx = await prisma.paymentTransaction.findFirst({
        where: { paymentId },
      });
      expect(tx).toBeDefined();
      expect(tx?.status).toBe("COMPLETED");

      // Verify webhook event was recorded for idempotency
      const webhookRecord = await prisma.webhookEvent.findUnique({
        where: { eventId: `paystack_${testRef}` },
      });
      expect(webhookRecord).toBeDefined();
      expect(webhookRecord?.source).toBe("PAYSTACK");
    });

    it("idempotently ignores replayed duplicate webhook without double-crediting", async () => {
      const payload = {
        event: "charge.success",
        data: {
          reference: testRef,
          amount: 15000000,
          channel: "card",
          status: "success",
        },
      };

      const rawBody = JSON.stringify(payload);
      const validSignature = crypto
        .createHmac("sha512", paystackSecret)
        .update(rawBody)
        .digest("hex");

      // Send the same webhook second time
      const res = await app.inject({
        method: "POST",
        url: "/api/public/webhooks/paystack",
        headers: {
          "x-paystack-signature": validSignature,
        },
        payload,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().message).toContain("Duplicate event acknowledged");

      // Count transactions to verify no duplicate transaction was inserted
      const txCount = await prisma.paymentTransaction.count({
        where: { paymentId },
      });
      expect(txCount).toBe(1);
    });
  });
});
