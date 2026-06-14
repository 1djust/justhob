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



