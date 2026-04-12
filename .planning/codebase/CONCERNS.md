# Concerns & Tech Debt

- **Authentication Flows**: Recent fixes were made to password reset flows and mandatory tenant password configurations, suggesting potential fragility in auth token lifespan handling and refreshing mechanisms between Flutter and the Fastify backend.
- **Supabase Connectivity**: Historical database connectivity issues between API host (Render) and Supabase hint at potential connection string pooling configuration difficulties (Prisma Connection Pooling). 
- **Environment Parity**: Firebase is utilized as a deployment pipeline alongside Supabase backends. Dual-platform reliance can complicate local vs production environment configuration. 
- **Code Generation Overreliance**: The project heavily depends on code generation (`build_runner` for Flutter, `prisma generate` for DB). Changes in schemas require developer vigilance to run these generation pipelines properly to prevent ghost errors.
