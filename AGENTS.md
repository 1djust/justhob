# AGENTS.md — Just hub Workspace

## Project Overview

This is a Turbo monorepo workspace at `C:\Users\USER\Desktop\Just hub`. Key projects:

- `property-management-saas/` — Main monorepo (API + Web workspaces)
- `tenant_app/` — Flutter mobile app
- `.agents/skills/` — Documentation/reference skills for agents

## Development Environment (WSL 2)

> **CRITICAL**: The web application and API have been migrated to native Ubuntu (WSL 2) to resolve performance bottlenecks. 

### Location Guide
- **Web & API Backend**: Lives exclusively in the Linux filesystem at `~/projects/justhub/property-management-saas`. ALL editing, running, and npm commands for the web stack MUST happen in the Ubuntu terminal or via VS Code attached to WSL.
- **Flutter Mobile App**: Remains on the Windows filesystem at `C:\Users\USER\Desktop\Just hub\tenant_app` to support native Android USB debugging.
- **Cross-OS Networking**: The Windows Flutter app connects to the WSL backend via `localhost` (Windows 11 automatically bridges WSL ports).

### Starting the Servers
1. Open Ubuntu terminal
2. `cd ~/projects/justhub`
3. `git pull` (always pull to ensure your Windows and Linux sides are in sync if you made mobile changes!) 
4. `cd property-management-saas`
5. `npm run dev`

### Code Syncing (Windows vs Linux)
Because the codebase is split for performance reasons, always use `git push` from one environment and `git pull` in the other if you have made cross-stack changes.

## Build, Lint, Test Commands

### Root (Turbo)
```bash
# All commands run from property-management-saas/ unless noted
cd property-management-saas

pnpm build          # Build all workspaces
pnpm dev            # Start all dev servers
pnpm lint           # Lint all workspaces
pnpm format         # Format all workspaces
```

### API (`apps/api/)` — Fastify + TypeScript
```bash
pnpm --filter api dev         # pnpm --filter api dev --filter api lint
pnpm --filter api build       # Build (tsc)
pnpm --filter api start        # Production start
pnpm --filter api typecheck    # TypeScript type checking
```

### Web (`apps/web/)` — Next.js 16 + Tailwind CSS
```bash
pnpm --filter web dev         # pnpm --filter web dev --filter web lint
pnpm --filter web build       # Build
pnpm --filter web start        # Production start
pnpm --filter web lint         # Lint (Next.js lint)
```

## Code Style

### TypeScript
- **Strict mode is enabled** in both `apps/web/tsconfig.json` and `apps/api/tsconfig.json`
- No `any` types — use `unknown` and narrow properly
- Explicit return types on public functions
- No non-null assertions (`!`) unless absolutely necessary

### Imports
- Use path alias `@/*` (configured in both apps)
  - `import { foo } from '@/lib/foo'` instead of relative paths
- Order: external → internal → relative
- No barrel re-exports that cause circular deps

### Naming
- **Files**: kebab-case (`user-service.ts`) or feature folders
- **Types/Interfaces**: PascalCase (`UserProfile`, `ApiResponse<T>`)
- **Variables/functions**: camelCase (`getUserById`, `isLoading`)
- **Constants**: SCREAMING_SNAKE_CASE
- **Boolean variables**: prefix with `is`, `has`, `should`, `can` (`isLoading`, `hasPermission`)

### Error Handling
- Never swallow errors silently — log or re-throw
- Use typed errors where possible
- API routes: return appropriate HTTP status codes with structured error bodies

### Async
- Use `async/await` over raw Promises
- Always handle rejected promises (try/catch or `.catch()`)
- No `void` async functions without error handling

## Framework Conventions

### Fastify (API)
- Plugins for route organization
- Typed request/reply with JSON Schema or TypeBox
- Decorators for DI-style patterns

### Next.js 16 (Web)
- App Router conventions (`app/` directory)
- Server Components by default, `'use client'` when needed
- `next-themes` for dark mode support
- Server actions for mutations

### Tailwind CSS
- Use Tailwind v4 utility classes
- No arbitrary values unless absolutely needed
- CSS custom properties for theme values

### Database (Supabase / Turso)
- Use migrations for schema changes
- Row Level Security (RLS) on all tables
- Typed clients via generated types

## General Guidelines

- **Always run `typecheck` and `lint` before finishing any task**
- If a command fails, do not mask the failure — surface the error
- Keep functions small and single-purpose
- No commented-out code in final submissions
- Write tests for business logic; skip for trivial wrappers
