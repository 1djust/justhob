# Super Admin Feature Plan

## Overview
Implement the Super Admin ("God Mode") portal to allow complete visibility and control over all workspaces, users, properties, and financial transactions.

## Project Type
WEB + BACKEND

## Tech Stack
- Frontend: Next.js (App Router), Tailwind CSS v4
- Backend: Fastify, Prisma
- Auth: Existing JWT-based system

## File Structure
- `apps/api/src/routes/super-admin/*`
- `apps/api/src/plugins/super-admin.ts`
- `apps/web/src/app/(admin)/super-admin/*`

## Task Breakdown
1. **Create Super Admin Plugin & API Routes** (Agent: `backend-specialist`, Skill: `api-patterns`)
   - INPUT: Authenticated API -> OUTPUT: `/api/super-admin/stats` protected by `SUPER_ADMIN` role -> VERIFY: Returns 403 for normal users.
2. **Create Super Admin Elevation Script** (Agent: `backend-specialist`, Skill: `nodejs-best-practices`)
   - INPUT: Prisma client -> OUTPUT: CLI script to update user role -> VERIFY: Script successfully updates DB.
3. **Build Super Admin Dashboard Layout** (Agent: `frontend-specialist`, Skill: `frontend-design`)
   - INPUT: Next.js App Router -> OUTPUT: `(admin)/super-admin/layout.tsx` -> VERIFY: Distinct visually from normal dashboard.
4. **Implement Dashboard Overview** (Agent: `frontend-specialist`, Skill: `react-best-practices`)
   - INPUT: API stats endpoint -> OUTPUT: Overview page with metrics and activity -> VERIFY: Data displays correctly.

## Phase X: Verification
- [ ] Run `python .agent/scripts/verify_all.py .`
- [ ] Build apps
- [ ] Manual Role Verification
