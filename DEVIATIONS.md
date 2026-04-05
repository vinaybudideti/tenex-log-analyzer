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

## 6. Next.js 15.5.14 with Tailwind CSS v4

Next.js 15.x matches BUILD_PLAN. However, `create-next-app@15` scaffolds with Tailwind CSS v4 (`@import "tailwindcss"` syntax, `@tailwindcss/postcss` plugin) instead of Tailwind v3 as BUILD_PLAN expected. This works fine with Turbopack (default dev server).

## 7. NODE_ENV=development in frontend dev script

The system has `NODE_ENV=production` set globally. Next.js refuses to start dev mode with non-standard NODE_ENV. The frontend `dev` script explicitly sets `NODE_ENV=development`.

## 8. Node 20 LTS pinned for production compatibility

`next build` fails on Node 22.13.1 with `TypeError: generate is not a function` in `generate-build-id.js`. Node 20 LTS is pinned via `.nvmrc` files and `engines` field in both package.json files to ensure Railway uses a compatible Node version. Local development machine runs Node 22 but only uses `next dev` (Turbopack) which is unaffected.

## 9. next.config.ts renamed to next.config.js

Next.js 15.5.14 on this machine doesn't detect `.ts` config files (the `find-config` loader returns `undefined`). Converted to `.js` with CommonJS `module.exports`. Added `output: 'standalone'` for Railway deployment.

## 10. frontend npm omit=dev

The system npm has `omit=dev` globally configured. Development dependencies (TypeScript, ESLint, Tailwind) require `npm install --include=dev` to install locally. Railway's build environment does not have this setting.
