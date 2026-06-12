# Known Issues & Bug Resolutions

This document serves as a knowledge base for tracking bugs encountered during development and the methods used to resolve them. If you run into a strange error, check here first.

---

## 1. Prisma Connection Timeout / Supabase Pooler (IPv6 Bug)

**Date**: May 17, 2026
**Environment**: WSL 2 (Ubuntu) / Node.js
**Error Message**: 
```text
Can't reach database server at aws-1-eu-north-1.pooler.supabase.com:6543
Please make sure your database server is running...
```

**Symptoms**:
- `npm run dev` or script executions (like `npx tsx setup-mega-test.ts`) hang or fail with a database connection timeout.
- Standard PostgreSQL clients (like the `pg` package or `psql`) connect perfectly to the same URL without issue.
- The `supabase.auth.admin.listUsers()` function or simple `fetch` requests occasionally time out to Supabase Cloudflare endpoints.

**Root Cause**:
Prisma's native Rust query engine has a known issue in certain environments (particularly WSL/Ubuntu) where it preferentially resolves and attempts to connect via IPv6. Supabase's connection pooler domains currently return IPv6 addresses that may not be properly routed from inside the local WSL network, causing the connection attempt to hang and eventually time out.

**Resolution (Updated June 2026)**:
Previously, the workaround was to hardcode the IPv4 address and append `sslmode=disable`. However, Supabase pooler now enforces SSL and using `sslmode=disable` will actively drop connections, resulting in the exact same `Can't reach database server` error. 

The IPv6 resolution issues appear to be resolved upstream, so the correct connection strings should use the standard pooler domain, `sslmode=require`, and `pgbouncer=true`:

*Correct `.env` configuration*:
```env
# Connection pooling (6543) for Prisma Client with pgbouncer=true
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"

# Direct connection (5432) for Prisma Migrations
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

---

## 2. Prisma Include Relation Missing Error (reset-tenant-payments.ts)

**Date**: June 11, 2026
**Error Message**:
```text
TypeError: Cannot read properties of undefined (reading 'workspaceId')
    at main (reset-tenant-payments.ts:42:40)
```

**Root Cause**:
When trying to access a nested relation (`firstLease.property.workspaceId`), the `property` relation was not explicitly fetched in the `prisma.tenant.findFirst` query. Prisma queries only return the data that is explicitly requested in the `include` block.

**Resolution**:
Updated the query in the script to deeply include the `property` table within `leases`:
```typescript
const tenant = await prisma.tenant.findFirst({
  where: { email },
  include: { 
    leases: {
      include: { property: true }
    } 
  }
});
```
