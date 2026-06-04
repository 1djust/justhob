# Code Review Checklists

> Stack-specific review checklists. Use alongside the SKILL.md methodology.

---

## Universal Checklist (All Stacks)

### Correctness
- [ ] Code does what the PR/task description says
- [ ] Edge cases handled (null, undefined, empty, 0, negative)
- [ ] Boundary conditions correct (off-by-one, overflow)
- [ ] No obvious logic errors
- [ ] State transitions are valid
- [ ] Concurrent access is safe

### Error Handling
- [ ] All async operations have error handling
- [ ] Errors are typed (not generic `Error`)
- [ ] No swallowed errors (empty catch blocks)
- [ ] User-facing errors are helpful but don't leak internals
- [ ] Retry logic has backoff and max attempts
- [ ] Resources are cleaned up in `finally`

### Security
- [ ] Input validated and sanitized at entry points
- [ ] No SQL/NoSQL injection vectors
- [ ] No XSS vectors (innerHTML, dangerouslySetInnerHTML)
- [ ] No hardcoded secrets or credentials
- [ ] Auth/authz checks on all protected paths
- [ ] No sensitive data in logs or error messages

### Performance
- [ ] No N+1 queries
- [ ] No unbounded data fetching (pagination present)
- [ ] No unnecessary re-renders / rebuilds
- [ ] Heavy imports are tree-shaken or lazy-loaded
- [ ] Caching used where appropriate
- [ ] No synchronous blocking on async operations

### Code Quality
- [ ] Functions are small (<30 lines) and single-purpose
- [ ] Nesting depth ≤ 3 levels
- [ ] No magic numbers or strings
- [ ] DRY — no copy-paste code
- [ ] Names reveal intent
- [ ] No commented-out code

### Testing
- [ ] Critical paths have unit tests
- [ ] Edge cases and error paths tested
- [ ] Tests are independent (no shared mutable state)
- [ ] Test names describe expected behavior
- [ ] Mocks are at the right boundary

---

## TypeScript Specific

### Type Safety
- [ ] No `any` types (use `unknown` and narrow)
- [ ] No non-null assertions (`!`) without justification
- [ ] Generic types used where appropriate
- [ ] Union types with exhaustive handling
- [ ] `satisfies` or `as const` for type narrowing
- [ ] Return types explicitly declared on public APIs

### Module Organization
- [ ] Imports use path aliases (`@/`)
- [ ] No circular dependencies
- [ ] No barrel files that cause tree-shaking issues
- [ ] External → internal → relative import order

### Async Patterns
- [ ] `async/await` over raw `.then()` chains
- [ ] No fire-and-forget `async` calls
- [ ] `Promise.all()` for independent async operations
- [ ] `AbortController` for cancellable requests
- [ ] Proper timeout handling on external calls

---

## Next.js (App Router) Specific

### Component Architecture
- [ ] Server Components by default
- [ ] `'use client'` only when absolutely needed (hooks, events, browser APIs)
- [ ] No data fetching in Client Components (use Server Components or Server Actions)
- [ ] `Suspense` boundaries around async components
- [ ] `loading.tsx` for route-level loading states
- [ ] `error.tsx` for route-level error boundaries

### Data Fetching
- [ ] Server Components fetch data directly (no `useEffect` for initial data)
- [ ] `revalidate` or `cache` configured for dynamic data
- [ ] No waterfall patterns (parallel data fetching where possible)
- [ ] Server Actions for mutations (not API routes)
- [ ] `redirect()` and `notFound()` used correctly

### SEO & Metadata
- [ ] `generateMetadata()` on all pages
- [ ] `<title>` and `<meta description>` are descriptive
- [ ] Proper heading hierarchy (`<h1>` once per page)
- [ ] Semantic HTML elements used
- [ ] `alt` text on all images

### Performance
- [ ] Images use `next/image` with proper sizing
- [ ] Fonts use `next/font`
- [ ] Dynamic imports for heavy components (`next/dynamic`)
- [ ] No unnecessary client-side JavaScript
- [ ] `React.memo()` / `useMemo()` / `useCallback()` used judiciously (not everywhere)

---

## Fastify (API) Specific

### Route Design
- [ ] All routes have JSON Schema / TypeBox validation
- [ ] Routes organized as encapsulated plugins
- [ ] Consistent RESTful naming conventions
- [ ] Proper HTTP status codes returned
- [ ] Structured error responses with error codes

### Authentication & Authorization
- [ ] `preHandler` hook for auth on protected routes
- [ ] Role-based access control enforced
- [ ] JWT/session validation on every protected endpoint
- [ ] No auth logic in route handlers (use hooks)

### Database Access
- [ ] Parameterized queries only (no string concatenation)
- [ ] Transactions for multi-step operations
- [ ] Connection pooling configured
- [ ] Query results are typed
- [ ] Row Level Security (RLS) considered

### Error Handling
- [ ] Custom error handler registered
- [ ] All errors return structured JSON
- [ ] 4xx errors don't leak stack traces
- [ ] 5xx errors logged with context
- [ ] Validation errors return 400 with field-level details

### Performance
- [ ] Response serialization schemas defined
- [ ] Rate limiting on public endpoints
- [ ] Pagination on list endpoints
- [ ] No blocking operations in request lifecycle
- [ ] Proper use of `fastify.decorate()` for DI

---

## Flutter / Dart Specific

### Widget Design
- [ ] Widgets are small and focused (<200 lines)
- [ ] No logic in `build()` — delegate to methods or providers
- [ ] `const` constructors used where possible
- [ ] Proper `Key` usage in lists and animated widgets
- [ ] No `BuildContext` used across async gaps

### State Management
- [ ] Consistent state management pattern (Riverpod/Bloc/Provider)
- [ ] No global mutable state
- [ ] State changes trigger minimal rebuilds
- [ ] Proper separation: UI state vs. business state
- [ ] Loading/error/empty states handled

### Lifecycle
- [ ] Controllers disposed in `dispose()`
- [ ] Stream subscriptions cancelled
- [ ] Listeners removed on widget unmount
- [ ] No memory leaks from retained references
- [ ] `mounted` checked before `setState` after async

### Null Safety
- [ ] No `!` operator abuse (use `?.` and `??`)
- [ ] Nullable types properly handled
- [ ] `late` used sparingly with clear initialization
- [ ] Default values for optional parameters

### Platform & Performance
- [ ] No hardcoded platform assumptions
- [ ] Images cached and properly sized
- [ ] Lists use `ListView.builder()` for large datasets
- [ ] Heavy computations offloaded to isolates
- [ ] Network calls have timeout and retry

---

## Database / Migration Specific

### Schema Changes
- [ ] Migration file created (not direct schema edit)
- [ ] Migration is reversible (has `down` migration)
- [ ] New columns have sensible defaults
- [ ] Indexes added for frequently queried columns
- [ ] Foreign keys and constraints defined

### Data Safety
- [ ] Destructive operations are behind feature flags
- [ ] Large data migrations are batched
- [ ] Backfill strategy documented
- [ ] RLS policies updated for new tables/columns

---

> **Usage:** Select the checklist sections relevant to the files being reviewed. Don't blindly check all boxes — apply judgment based on context.
