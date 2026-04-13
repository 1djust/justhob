# Architecture

The system involves three primary deployment targets linked by a Turbo monorepo and a standalone Flutter application:

1. **Database Layer (Supabase + Prisma)**: A PostgreSQL database powered by Supabase with schema definitions managed by Prisma in `packages/database`. RLS (Row Level Security) defines the authorization schema.

2. **API (Fastify Backend)**: A Node.js service exposing REST endpoints, connected to Prisma. Includes webhooks for third-party integrations (like payment providers). Built with Fastify and grouped into decoupled domain logic. Exposes specific tenant and multi-tenant logic.

3. **Web Client (Next.js)**: Server Components by default using Next.js App Router for landlord/manager facing "Property Management SaaS" web interfaces. Accesses the API or Prisma directly using Next.js server actions.

4. **Mobile App (Flutter)**: A standalone `tenant_app` built with Flutter targeting iOS/Android. Interfaces with the Fastify REST backend. Adopts a feature-driven architecture using Riverpod and GoRouter. It leverages a custom Over-The-Air (OTA) update checker mapped automatically against the Web Application's hosted `version.json` registry to enforce downloads of new releases bypassing standard app stores.
