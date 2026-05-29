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

**Resolution**:
We bypassed the IPv6 DNS resolution by hardcoding the resolved IPv4 address of the Supabase pooler in the connection string and explicitly disabling SSL hostname verification (since the certificate is bound to the domain name, not the raw IP).

*Steps to fix*:
1. Ping or lookup the IPv4 address of your Supabase pooler domain: `ping aws-1-eu-north-1.pooler.supabase.com` -> (e.g., `51.21.189.77`).
2. Update the `.env` files (`apps/api/.env` and `packages/database/.env`):
   ```env
   # Replace the hostname with the IPv4 address, and append &sslmode=disable
   DATABASE_URL="postgresql://postgres.[project-ref]:[password]@51.21.189.77:6543/postgres?pgbouncer=true&sslmode=disable"
   DIRECT_URL="postgresql://postgres.[project-ref]:[password]@51.21.189.77:5432/postgres?sslmode=disable"
   ```
   *(Note: This workaround should strictly be kept to local development `.env` files.)*
