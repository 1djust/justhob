# 🐞 Bug Fixes Log

This document serves as the central source of truth for all confirmed bug fixes, root cause analyses, and solutions in the PropertyStack project. 

It works in tandem with the `.agents/skills/` directory: every time a bug is logged here, a summarized rule is added to the relevant AI skill file to ensure the AI natively remembers the fix and prevents future regressions.

---

## 📝 Protocol
1. Bug is found and fixed by AI.
2. Human tests the fix.
3. Human replies: `FIXED`.
4. AI asks: `Can I document this fix?`
5. Human replies: `Yes`.
6. AI logs the fix here AND injects a prevention rule into the relevant skill file.

---

*(Future fixes will be appended below)*

---

## 1. Prisma P1001 Database Connection Timeout under WSL 2

**Date**: June 13, 2026
**Environment**: WSL 2 (Ubuntu) / Node.js / Vitest
**Bug/Latency**: Test execution (Vitest) hung and timed out with a P1001 error (`Can't reach database server...`) trying to connect to the Supabase pooler.
**Root Cause**: Prisma's native Rust query engine has a DNS resolution bug in WSL 2 where it fails to resolve hostnames (like `aws-1-eu-north-1.pooler.supabase.com`) or attempts IPv6 paths that are not routable.
**Resolution**:
- Modified [setup.ts](file:///home/djust/projects/justhub/property-management-saas/apps/api/tests/setup.ts) and [index.ts](file:///home/djust/projects/justhub/property-management-saas/apps/api/src/index.ts) to dynamically resolve the pooler hostname using Node's `dns.resolve4` at startup.
- Dynamically swapped the pooler hostname in the database connection string with the resolved IPv4 address before initializing the Prisma Client.

---

## 2. Dashboard, Properties, and Payments Tabs Loading Latency

**Date**: June 13, 2026
**Environment**: Web App / API Backend
**Bug/Latency**: High loading lag (multi-second delays) when managers switched between the Dashboard, Properties, Payments, and Tenants tabs.
**Root Cause**: Lack of API caching led to sequential, blocking database calls on every tab transition.
**Resolution**:
- Centralized in-memory caching module [cache.ts](file:///home/djust/projects/justhub/property-management-saas/apps/api/src/lib/cache.ts) with a `CACHE_TTL` of 120,000ms.
- Integrated cache checking and population into auth, properties, workspaces, tenants, payments, and maintenance routes.
- Implemented immediate and absolute cache invalidation (`clearWorkspaceCache`) on all resource-mutating operations (POST/PUT/PATCH/DELETE) to ensure real-time data accuracy.
- Added database indexes on foreign keys, status fields, and soft-delete dates in [schema.prisma](file:///home/djust/projects/justhub/property-management-saas/packages/database/prisma/schema.prisma).

---

## 3. Landing Page Loading Latency (propertystack.vercel.app)

**Date**: June 14, 2026
**Environment**: Web App / Vercel Production
**Bug/Latency**: High initial page load latency on the public landing page.
**Root Cause**: Unoptimized HTML `<img>` elements loaded large raw assets (including a 2.13 MB logo and 1.7 MB of preview screenshots) immediately on startup, without scaling, modern formats, or lazy-loading.
**Resolution**:
- Compressed the repository `logo.png` from **2.13 MB** to **35 KB** (resizing to 256x256 pixels).
- Migrated all landing page and dashboard carousel image tags in [LandingPage.tsx](file:///home/djust/projects/justhub/property-management-saas/apps/web/src/components/landing/LandingPage.tsx) and [DashboardCarousel.tsx](file:///home/djust/projects/justhub/property-management-saas/apps/web/src/components/landing/DashboardCarousel.tsx) to Next.js's `<Image>` component, enabling automatic responsive optimization (WebP/AVIF), proper layout dimensions, above-the-fold priority loading, and below-the-fold lazy-loading.

---

## 4. Missing Release Keystore and Landing Page Download 404 Error

**Date**: June 14, 2026
**Environment**: Mobile App / Web Public Assets
**Bug/Latency**: The mobile app lacked a release keystore configuration (which prevented signing the release build), and the download button on the landing page returned a 404 error because `propertystack-tenant.apk` did not exist in the public asset downloads.
**Resolution**:
- Generated a custom Java Keystore (`key.jks`) inside the [android/app/](file:///home/djust/projects/justhub/tenant_app/android/app/) directory configured with the release credentials defined in [build.gradle.kts](file:///home/djust/projects/justhub/tenant_app/android/app/build.gradle.kts).
- Compiled a signed production release APK using `flutter build apk --release`.
- Copied and deployed the compiled APK to the web app's public assets folder under:
  - [propertystack-tenant.apk](file:///home/djust/projects/justhub/property-management-saas/apps/web/public/downloads/propertystack-tenant.apk) (resolves landing page 404).
  - [justhub-tenant.apk](file:///home/djust/projects/justhub/property-management-saas/apps/web/public/downloads/justhub-tenant.apk) (updates update URL target).
  - [estateos-tenant.apk](file:///home/djust/projects/justhub/property-management-saas/apps/web/public/downloads/estateos-tenant.apk) (updates legacy target).

---

## 5. Super Admin Users Management Screen Empty due to Restrictive Workspace Query Filter

**Date**: June 26, 2026
**Environment**: Web App / API Backend / Super Admin Console
**Bug/Latency**: The dashboard displayed "Total Users: 13", but the "Users Management" screen was completely empty.
**Root Cause**: The `/users` API query had a hardcoded filter requiring users to have the `PROPERTY_MANAGER` role and active `WorkspaceMember` records. Since the development database contained 0 workspace membership rows, the endpoint returned an empty list. Meanwhile, the dashboard counted users directly from the `User` table without any filters.
**Resolution**:
- Removed the restrictive workspace membership query filter from the `GET /users` endpoint in [super-admin.ts](file:///home/djust/projects/justhub/property-management-saas/apps/api/src/routes/super-admin.ts).
- Made the endpoint retrieve all users regardless of their workspace membership status, resolving the discrepancy with the dashboard's total users count.

## 6. Systemic User Orphaning — Missing WorkspaceMember Records (Critical)

**Date**: June 26, 2026
**Environment**: API Backend — auth.ts, owners.ts, tenants.ts
**Severity**: 🔴 Critical — affects 92% of all users in the system

**Bug/Latency**: 12 out of 13 users existed in the `User` table but had **zero** `WorkspaceMember` records, making them effectively invisible to the platform. Only 1 user (`solomon4drama@gmail.com`) had a valid workspace membership. The `Tenant` table was completely empty (0 records). 8 workspaces existed but 7 had zero members.

**Root Causes** (3 separate defects):

1. **Auto-Heal ID Mismatch Cascade Delete** (`auth.ts` L105-122):
   - When a user's Supabase auth ID changed (e.g., re-registration), the auto-heal code ran `UPDATE "User" SET id = newId WHERE email = ...`.
   - This changed the User's primary key, but `WorkspaceMember` has `onDelete: Cascade` on its `userId` FK.
   - Result: All `WorkspaceMember` records for that user were silently cascade-deleted.
   - **Also affected**: `Notification`, `MaintenanceMessage`, `Property` FK references.

2. **Non-Transactional Owner/Landlord Creation** (`owners.ts` L204-225):
   - `prisma.user.create()` and `prisma.workspaceMember.create()` were separate calls, not wrapped in a transaction.
   - If the second call failed (network error, constraint violation), the User existed without a workspace membership.

3. **Missing Orphan Detection** (`auth.ts` L163-184):
   - No post-creation verification that the nested `workspaces.create` inside `user.create` actually succeeded.
   - If it failed silently (e.g., workspace creation error), the user was left with 0 workspace memberships.

**Resolution**:
- **Fix 1 — auth.ts Auto-Heal**: Wrapped the ID update in a `$transaction` that updates ALL FK references (`WorkspaceMember.userId`, `Notification.userId`, `MaintenanceMessage.senderId`, `Property.ownerId`) BEFORE changing `User.id`. This prevents cascade deletion of workspace memberships.
- **Fix 2 — owners.ts Transaction**: Wrapped `user.create` + `workspaceMember.create` in a single `$transaction` so both succeed or both roll back atomically.
- **Fix 3 — auth.ts Orphan Guard**: Added a post-creation check after user creation. If a user has 0 workspace memberships and is a `PROPERTY_MANAGER`, the system self-repairs by creating a default "My Properties" workspace. For `TENANT` and `LANDLORD` users, it does not self-repair and instead rejects access.
- **Fix 4 — auth.ts Login & Sync Gatekeeper**: Unregistered `TENANT` and `LANDLORD` users (who have 0 workspace memberships) are rejected at `/auth/sync` with HTTP 403 and the message: *"Your account has not been set up by a property manager yet. Please contact your property manager to register your access."* Additionally, the `/auth/login` endpoint (used exclusively by the mobile app) is restricted strictly to `TENANT` users. Any other roles (`PROPERTY_MANAGER`, `LANDLORD`, `SUPER_ADMIN`), whether registered or not, are rejected on `/auth/login` with HTTP 403 and code `TENANT_ONLY_APP` directing them to the web dashboard.

**Prevention Rules**:
- Never change a User's primary key without updating ALL FK-referencing tables in the same transaction.
- Always wrap User + WorkspaceMember creation in atomic transactions.
- Always verify workspace membership exists after user creation for non-admin users.
- Never auto-create User records or default workspaces for unregistered `TENANT` or `LANDLORD` users — reject them at the gate (both login and sync) with a clear error.
- Always restrict the mobile login endpoint (`/auth/login`) exclusively to `TENANT` roles, and reject all other roles (`PROPERTY_MANAGER`, `LANDLORD`, `SUPER_ADMIN`) with a clear error directing them to the web dashboard.
- Add monitoring/alerting for orphaned users (users with 0 workspace memberships).

