# Integrations

## Backend as a Service
- **Supabase**: Used for authentication, database hosting (PostgreSQL), and Row Level Security (RLS). 

## Database Management
- **Prisma**: ORM utilized by the Fastify API (and potentially Next.js) for querying and mutating data safely. Found in `packages/database`.

## Client Integrations
- **Dio Cookie Manager**: Used in the Flutter app to handle session cookies and token lifecycles alongside `flutter_secure_storage`. 

## Deployment & Hosting
- **Firebase Tools**: Listed in devDependencies. Used for hosting custom domains or deployments.
- **Render**: Mentioned historically as the backend hosting solution. Connected to Supabase DB.
