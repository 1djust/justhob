# PropertyStack: Security Operations & Secrets Hygiene Guide

This guide establishes the mandatory security operations protocols, secret trust boundaries, key rotation procedures, and incident containment policies for the PropertyStack platform.

---

## 1. Secret Classifications & Trust Boundaries

| Secret Name | Layer | Trust Boundary | Safe in Client Bundle? | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend API | **Strict Confidential** | ❌ **NEVER** | Superuser bypass for backend Prisma & admin automation |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web / Mobile | Public Client | ✅ **YES** | User JWT authentication & public auth endpoints |
| `PAYSTACK_SECRET_KEY` | Backend API | **Strict Confidential** | ❌ **NEVER** | Webhook HMAC verification, bank payouts, charges |
| `DATABASE_URL` / `DIRECT_URL` | Backend API | **Strict Confidential** | ❌ **NEVER** | PostgreSQL connection strings (Render / AWS / Supabase) |
| `SUPABASE_WEBHOOK_SECRET` | Backend API | **Strict Confidential** | ❌ **NEVER** | Authorization token for database auth trigger hooks |
| `ADMIN_SECURITY_KEY` | Backend API | **Strict Confidential** | ❌ **NEVER** | Super Admin MFA and elevated action authentication |

---

## 2. Key Rotation Procedures

### A. Rotating Paystack Secret Keys
1. Log in to the [Paystack Dashboard](https://dashboard.paystack.com/#/settings/developer).
2. Go to **Settings → API Keys & Webhooks**.
3. Generate a new Secret Key.
4. Update the `PAYSTACK_SECRET_KEY` environment variable in:
   - **Render Dashboard** (API Backend Service).
5. Trigger a redeploy of the API service on Render.
6. Test payment initialization and webhook verification in staging.
7. Revoke the old Secret Key in Paystack after confirming successful deployment.

### B. Rotating Supabase Service Role Key
1. Log in to the [Supabase Dashboard](https://supabase.com/dashboard/project/_/settings/api).
2. Go to **Project Settings → API**.
3. Under **Project API keys**, click **Generate new secret key**.
4. Update `SUPABASE_SERVICE_ROLE_KEY` in Render environment settings.
5. Redeploy the API backend.
6. Verify authentication, user sync, and storage uploads.
7. Delete / expire the previous service role key in Supabase.

### C. Rotating PostgreSQL Database Passwords
1. Go to **Supabase Dashboard → Project Settings → Database**.
2. Click **Reset Database Password**.
3. Copy the newly generated connection strings for:
   - Transaction Connection Pooler (`DATABASE_URL`, port `6543`)
   - Direct Connection (`DIRECT_URL`, port `5432`)
4. Update `DATABASE_URL` and `DIRECT_URL` in Render.
5. Redeploy API backend and verify database connectivity with `GET /health`.

---

## 3. Emergency Secret Leak Containment Checklist

In the event that an API key or database credential is accidentally exposed:

1. **Immediate Revocation (< 15 minutes)**:
   - Revoke the compromised key in the provider dashboard (Supabase / Paystack / AWS).
2. **Rotate Environment Variables**:
   - Issue a new credential and update the hosting platform environment settings immediately.
3. **Audit Access Logs**:
   - Query `SecurityAuditLog` and provider API access logs for anomalous IP addresses or bulk exports.
4. **Invalidate Active Sessions**:
   - Clear backend `authCache` and invoke Supabase Admin session revocation for affected accounts.
5. **Post-Mortem**:
   - File an incident report documenting root cause, exposure duration, and preventative action items.

---

## 4. Automated Verification Tooling

To verify environment variable integrity prior to deployment, execute:

```bash
bash scripts/verify-env-security.sh
```
