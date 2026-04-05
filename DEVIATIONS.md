# Deviations from BUILD_PLAN.md

This file documents intentional deviations from the original build plan.

---

## 1. Prisma 7.6.0 instead of 6.x

BUILD_PLAN specifies Prisma 6.x, but `npm install` pulled Prisma 7.6.0 (latest stable at install time). The plan says "Use LATEST stable versions" so this is consistent with intent.

## 2. Driver adapter pattern (@prisma/adapter-pg + pg)

Prisma 7 requires an explicit driver adapter for direct database connections. The `@prisma/adapter-pg` and `pg` packages were added as dependencies. PrismaClient is instantiated with `{ adapter: new PrismaPg(connectionString) }` instead of the zero-arg constructor from Prisma 5/6.

## 3. Custom client output path (src/generated/prisma/)

Prisma 7 generates the client to `backend/src/generated/prisma/` instead of `node_modules/@prisma/client`. All model type imports (`User`, `LogEntry`, etc.) are re-exported from `backend/src/lib/prisma.ts` so that no other file references the generated path directly.

BUILD_PLAN imports like `import type { LogEntry } from '@prisma/client'` become `import type { LogEntry } from '../lib/prisma'`.

## 4. Postgres on port 5433 locally

The host machine has a system Postgres running on port 5432. Docker Compose maps to port 5433 instead to avoid conflict. DATABASE_URL uses `localhost:5433`. This is local-dev only; Railway production uses its own DATABASE_URL.

## 5. dotenv override: true

The system has a PORT environment variable (set by the IDE/shell). `dotenv.config({ override: true })` is used in server.ts so that `.env` values take precedence over system env vars locally.
