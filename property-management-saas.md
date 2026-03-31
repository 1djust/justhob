# Property Management SaaS Plan

## Overview
Build a modern SaaS property management web app focusing on secure authentication and modular architecture.

## Project Type
WEB + BACKEND

## Success Criteria
- Secure JWT authentication with `httpOnly` cookies
- Robust PostgreSQL database setup with Prisma
- Role-based access using Workspace model (Landlord, Tenant)
- Clean, modern Next.js + Tailwind CSS UI with Dark/Light mode
- Fully functional Login, Register, and Dashboard placeholder

## Tech Stack
- **Frontend:** Next.js (App Router), Tailwind CSS v4, React 19
- **Backend:** Node.js, Fastify, Prisma ORM
- **Database:** PostgreSQL

## File Structure
```
project-root/
├── apps/
│   ├── web/        # Next.js frontend
│   └── api/        # Fastify backend
└── packages/
    ├── database/   # Prisma schema and client
    └── config/     # Shared ESLint/TS configs
```

## Task Breakdown
1. **Initialize Monorepo & Database** (Agent: `backend-specialist`, Skill: `prisma-expert`)
   - INPUT: Empty repo → OUTPUT: Turborepo with Fastify & Prisma → VERIFY: `npx prisma generate` passes.
2. **Implement Backend Auth** (Agent: `backend-specialist`, Skill: `nodejs-best-practices`)
   - INPUT: Fastify app → OUTPUT: `/auth/register` and `/auth/login` with `httpOnly` cookies → VERIFY: API responds with Set-Cookie header.
3. **Implement Workspace RBAC** (Agent: `backend-specialist`, Skill: `api-patterns`)
   - INPUT: Authenticated API → OUTPUT: `/workspaces` endpoints for Landlord/Tenant roles → VERIFY: API returns correct roles based on user session.
4. **Initialize Frontend App** (Agent: `frontend-specialist`, Skill: `react-best-practices`)
   - INPUT: Next.js skeleton → OUTPUT: Tailwind v4 configured with dark/light mode → VERIFY: UI renders correctly.
5. **Implement Frontend Auth Pages** (Agent: `frontend-specialist`, Skill: `frontend-design`)
   - INPUT: UI setup → OUTPUT: Login/Register forms connecting to API → VERIFY: Successful login redirects to dashboard.
6. **Implement Dashboard Placeholder** (Agent: `frontend-specialist`, Skill: `frontend-design`)
   - INPUT: Auth pages → OUTPUT: Protected dashboard fetching user profile → VERIFY: Unauthenticated users are redirected.

## Phase X: Verification
- [x] Run `python .agent/scripts/checklist.py .` (Security, Lint, Type Check)
- [x] Run `npm run build` for both apps
- [x] Manual End-to-End Test

## ✅ PHASE X COMPLETE
- Lint: ✅ Pass
- Security: ✅ No critical issues
- Build: ✅ Success
- Date: 2026-03-24
