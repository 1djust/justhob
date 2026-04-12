# Directory Structure

## Repository Root
- **`property-management-saas/`**: Turbo monorepo containing Web and API.
  - **`apps/api/`**: Fastify backend.
    - `src/index.ts`: Application entrypoint.
    - `src/routes/`: Route declarations including webhooks.
    - `src/services/`: Core logic and integration services.
    - `src/lib/`: Internal api utilities.
  - **`apps/web/`**: Next.js frontend GUI.
    - `src/app/`: Next.js App Router endpoints and pages.
    - `src/components/`: Reusable React components (auth, themes).
    - `src/lib/`: Common Web GUI utilities.
  - **`packages/database/`**: Prisma schemas and database configurations serving as a shared resource.

- **`tenant_app/`**: Flutter application.
  - `lib/core/`: Configuration, routing, networking clients (Dio).
  - `lib/features/`: Feature-sliced architecture (`auth`, `home`, `maintenance`, `payments`, `profile`).
  - `lib/shared/`: Shared domain objects, models (`maintenance_request.dart`, `tenant.dart`, `payment.dart`), and common UI widgets.
