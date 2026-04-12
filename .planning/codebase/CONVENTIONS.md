# Coding Conventions

- **TypeScript Strict Mode**: Fully enabled in Web and API (`apps/web/tsconfig.json` & `apps/api/tsconfig.json`). Ensure no `any` types. Use `unknown` and narrow properly.
- **Imports**: Absolute imports via `@/*` aliases are heavily encouraged over relative paths. 
- **Naming Constraints**:
  - Files: `kebab-case` (e.g., `user-service.ts`)
  - Types/Interfaces: `PascalCase`
  - Constants: `SCREAMING_SNAKE_CASE`
  - Booleans: Prefix with `is`, `has`, `should`, `can`
- **Error Handling**: No silently suppressed errors. Utilize specific typed errors rather than generic responses. Server processes must always return proper JSON HTTP codes.
- **Async Execution**: Prefer `async/await` syntax. No dangling promises - appropriately try/catch or chain `.catch()`. 
- **Mobile State Management**: Riverpod for Flutter dependency injection and immutable state update chains, combined with Freezed for domain entities. Riverpod Generators utilized.
