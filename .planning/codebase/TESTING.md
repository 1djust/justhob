# Testing

## Current State
- Flutter mobile app contains `flutter_test` dependency targeting the UI layout blocks.
- Fastify/Next.js ecosystem relies extensively on TypeScript type definitions to avoid runtime errors, utilizing automated tools like `turbo run lint` and `tsc` for type-checking.

## Requirements
- Test-driven approach is recommended for business logic calculations.
- Always run `typecheck` and `lint` prior to finalizing development flows. 
- `pnpm format` configured via Prettier for enforcing syntax consistencies.
