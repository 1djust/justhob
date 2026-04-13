# Getting Started with Property Management SaaS

Follow these steps to set up and run the application locally.

## Prerequisites

- **Node.js**: version 18 or higher.
- **PostgreSQL**: A running instance (local, Docker, or Cloud like Supabase/Neon).

## 0. Getting your DATABASE_URL

The `DATABASE_URL` format is: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`

### Option A: Cloud (Recommended for speed, 100% Free)
Create a free project on [Supabase](https://supabase.com) (Recommended) or [Neon](https://neon.tech). They provide connection strings immediately.

### Option B: Local Installation
If you have Postgres installed locally:
- **USER**: your system username (often `postgres`)
- **PASSWORD**: the password you set during installation
- **HOST**: `localhost`
- **PORT**: `5432`
- **DATABASE**: any name (e.g., `property_mgmt`).

Example: `postgresql://postgres:mysecretpassword@localhost:5432/property_mgmt`

---

## 1. Environment Configuration

You need to create `.env` files for the database and the API.

### Database (`packages/database/.env`)
```env
DATABASE_URL="postgresql://username:password@localhost:5432/property_mgmt"
DIRECT_URL="postgresql://username:password@localhost:5432/property_mgmt"
```

### API (`apps/api/.env`)
```env
DATABASE_URL="postgresql://username:password@localhost:5432/property_mgmt"
JWT_SECRET="your-secret-key-here"
FRONTEND_URL="http://localhost:3000"
COOKIE_SECRET="another-secret-key-here"
```

---

## 2. Installation & Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Database Sync**:
   Push the schema to your PostgreSQL database:
   ```bash
   npm run push --workspace=@property-management/database
   ```

3. **Install Browser Engines** (Required for Web E2E tests):
   ```bash
   npx playwright install
   ```

---

## 3. Run the Application

Start both the backend API and the frontend web app:
```bash
npm run dev
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:3001](http://localhost:3001)

---

## 4. Automated Testing (Regression Tests)

We have established a robust suite of regression tests.

- **Run all tests**: `npm run test`
- **API Tests (Vitest)**: Fast integration tests using Fastify's `inject`.
- **Web Tests (Playwright)**: End-to-end browser tests.

---

## 5. Production Monitoring (Free Alternative)

The system uses a custom, zero-cost monitoring solution instead of Sentry.

- **Error Logs**: All API crashes and client-side errors are logged to the `ErrorLog` table in your database.
- **Performance**: Slow API responses (>3s) are logged as warnings.
- **How to view logs**: Open your database dashboard (e.g., Supabase) and inspect the `ErrorLog` table.

---

## 6. Releasing Mobile App Updates (OTA)

The application bypassed traditional App Stores by implementing a modern Over-The-Air (OTA) direct downloader pipeline from the web frontend.

When you want to deploy a new version of the Flutter Mobile app:
1. Bump the release version mapping in `tenant_app/pubspec.yaml` (e.g., `version: 0.1.0+2`).
2. Construct the Android APK (`flutter build apk`).
3. Take your `app-release.apk` output and copy it to `apps/web/public/downloads/justhub-tenant-latest.apk`.
4. Update `apps/web/public/downloads/version.json` and change `"latestBuildNumber"` to match your new `+2` build code.
5. Tenants will automatically experience an update prompt upon their next `HomeScreen` launch.
