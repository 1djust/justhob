# Tech Stack

## Monorepo
- **Tool**: Turbo repo (`turbo`)
- **Package Manager**: npm 10.2.3
- **Database**: Prisma ORM, Supabase Database (PostgreSQL)

## Backend API (`apps/api`)
- **Runtime**: Node.js >= 18
- **Framework**: Fastify 4.26
- **Language**: TypeScript 5.4
- **Auth/Backend-as-a-service**: Supabase JS 2.100

## Web Application (`apps/web`)
- **Framework**: Next.js 16.2 App Router
- **Language**: TypeScript 5
- **UI Library**: React 19.2
- **Styling**: Tailwind CSS v4, `clsx`, `tailwind-merge`
- **Icons & Charts**: Lucide React, Recharts

## Mobile Application (`tenant_app`)
- **Framework**: Flutter 3.11+
- **State Management**: Riverpod (riverpod_annotation, riverpod_generator)
- **Routing**: Go Router
- **Networking**: Dio
- **Data models**: Freezed, json_serializable
