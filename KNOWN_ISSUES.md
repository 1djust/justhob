# Known Issues & Bug Resolutions

This document serves as a knowledge base for tracking bugs encountered during development and the methods used to resolve them. If you run into a strange error, check here first.

---

## 1. Prisma Connection Timeout / Supabase Pooler (IPv6 Bug)

**Date**: May 17, 2026
**Environment**: Node.js
**Error Message**: 
```text
Can't reach database server at aws-1-eu-north-1.pooler.supabase.com:6543
Please make sure your database server is running...
```

**Symptoms**:
- `pnpm dev` or script executions (like `npx tsx setup-mega-test.ts`) hang or fail with a database connection timeout.
- Standard PostgreSQL clients (like the `pg` package or `psql`) connect perfectly to the same URL without issue.
- The `supabase.auth.admin.listUsers()` function or simple `fetch` requests occasionally time out to Supabase Cloudflare endpoints.

**Root Cause**:
Prisma's native Rust query engine had an issue in environments where it preferentially resolves and attempts to connect via IPv6. Supabase's connection pooler domains return IPv6 addresses that may not be properly routed from inside local networks, causing the connection attempt to hang and eventually time out.

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

---

## 3. Flutter Android Build: Gradle Transform Cache & SSL Handshake Failures

**Date**: September 29, 2026  
**Environment**: Windows (PowerShell), Flutter SDK, OpenJDK 21 (JBR), Gradle 8.14  
**Error Messages**:
```text
Could not read workspace metadata from C:\Users\USER\.gradle\caches\8.14\transforms\...\metadata.bin
```
```text
javax.net.ssl.SSLHandshakeException: No subject alternative DNS name matching download.flutter.io found
```
```text
adb.exe: device offline
```

**Symptoms**:
- `flutter run -d emulator-5554` failed during `settings.gradle.kts` configuration with corrupt Gradle transform metadata errors.
- Gradle downloads for `io.flutter:x86_64_debug` stalled indefinitely or aborted with SSL certificate SAN errors on Java 21.
- `adb` commands and `adb install` hung or showed `emulator-5554 offline` when background logcat streams remained unclosed on Windows.

**Root Cause**:
1. Aborted or interrupted Gradle processes left partial `.bin` cache metadata files in `.gradle/caches/8.14/transforms/`.
2. Java 21 enforces strict Subject Alternative Name (SAN) verification on TLS certificates; the endpoint `download.flutter.io` lacked matching SAN entries on the server certificate, causing Java's SSL verifier to reject connections. Direct GCS download connections also hung intermittently on the local connection.
3. Windows ADB server sockets deadlocked when multiple zombie logcat client processes held open file descriptors to the ADB daemon.

**Resolution**:
1. **Purged Corrupt Transform Caches**: Stopped all Java daemons and purged `~/.gradle/caches/8.14/transforms/`.
2. **Configured Mirror Repositories**: Updated `propertystack_mobile/android/settings.gradle.kts` and `propertystack_mobile/android/build.gradle.kts` to route Flutter engine artifact downloads through `https://storage.flutter-io.cn/download.flutter.io`.
3. **ADB Daemon Reset**: Terminated orphaned `adb.exe` processes and restarted the server via `adb start-server`.
4. **Local PM Install Fallback**: For fast installation without ADB streaming stalls, push the built APK to `/data/local/tmp/app.apk` and run `adb shell pm install -r -d /data/local/tmp/app.apk`.

