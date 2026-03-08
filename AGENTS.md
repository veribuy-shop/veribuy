# AGENTS.md

Agent reference for the VeriBuy monorepo (pnpm workspaces + Turborepo).

## Stack

- **Backend:** NestJS 11, Prisma 6, PostgreSQL 17 (separate schema per service)
- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS 4
- **Infra:** RabbitMQ, Redis, MinIO, OpenTelemetry/Jaeger, Prometheus
- **Package manager:** pnpm@10.30.2, Node >=22
- **Ports:** Gateway 3000 · Auth 3001 · User 3002 · Listing 3003 · TrustLens 3004 · Evidence 3006 · Transaction 3007 · Notification 3008 · Web 3010

## Build / Lint / Test Commands

```bash
# Root (runs all services via Turborepo)
pnpm build                        # Build everything
pnpm lint                         # Lint everything
pnpm test                         # Test everything
pnpm prisma:generate              # Regenerate all Prisma clients
pnpm prisma:migrate               # Run all migrations

# Per-service (use workdir or cd into services/<name>)
pnpm --filter <service-name> build
pnpm --filter <service-name> lint
pnpm --filter <service-name> test
pnpm --filter <service-name> test -- <file>          # single file
pnpm --filter <service-name> test -- -t "test name"  # single test by name
pnpm --filter <service-name> prisma:generate
pnpm --filter <service-name> prisma:migrate

# Frontend
pnpm --filter web build
pnpm --filter web lint

# Docker
pnpm docker:up    # start full stack
pnpm docker:down  # stop stack
```

**After editing a Prisma schema always run `prisma:generate` for that service before building.**

## Code Style

### TypeScript
- Strict mode enabled everywhere (`strict`, `strictNullChecks`, `noImplicitAny`)
- Always declare return types explicitly on async functions
- Prefer `interface` for object shapes; use `type` for unions/primitives
- NestJS services require `experimentalDecorators` + `emitDecoratorMetadata`

### Imports
```typescript
// NestJS: external first, then internal (relative)
import { Injectable } from '@nestjs/common';
import * as nodeCrypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// Next.js: React/Next first, then internal with @ alias
import Link from 'next/link';
import { cn } from '@/lib/utils';
```
- NestJS services use relative paths only (no path aliases)
- Next.js uses `@/*` mapped to root

### Naming
- Files: `*.controller.ts`, `*.service.ts`, `*.module.ts`, `*.dto.ts` (NestJS); `page.tsx`, `layout.tsx`, kebab-case components (Next.js)
- Classes / interfaces / enums / React components: `PascalCase`
- Variables / functions / methods: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Prisma models: `PascalCase`; DB columns: `snake_case` via `@map()`; tables: `snake_case` via `@@map()`

### Formatting
- 2-space indentation
- Single quotes in TypeScript, double quotes in JSON
- Semicolons required
- Trailing commas in multiline objects/arrays

### NestJS Patterns
- Use built-in HTTP exceptions (`NotFoundException`, `ForbiddenException`, `ConflictException`, etc.)
- DTOs use `class-validator` decorators; always enable `ValidationPipe({ whitelist: true, transform: true })`
- Override user identity from JWT in controllers — never trust client-supplied `userId`/`sellerId`
- All list endpoints return `PaginatedResponse<T>` using `PaginationDto` from `@veribuy/common`
- Run parallel DB queries with `Promise.all()` for count + data fetches

### Security
- Guards: `@UseGuards(JwtAuthGuard, RolesGuard)` on all controllers; `@Public()` to opt out
- Ownership check pattern: fetch resource, compare `ownerId === user.userId`, allow if `user.role === 'ADMIN'`
- Inter-service calls use `x-internal-service` header with timing-safe token comparison via `nodeCrypto.timingSafeEqual`
- Frontend tokens: HttpOnly cookies only — never `localStorage`; always `credentials: 'include'` on fetch

### Caching (Redis)
- Cache keys: `listing:{id}`, `profile:{userId}`, `unread:{userId}`
- TTL: 300s (listings), 600s (profiles), 60s (unread counts)
- Always `redis.del(key)` immediately after any update or delete

### Prisma
- Each service has its own schema file and PostgreSQL schema namespace
- Use explicit `select` in `include` — never include full related models
- Index all foreign keys, status/enum fields, and timestamp sort fields
- Composite indexes for common query patterns (e.g. `[sellerId, status]`)

### Next.js
- Server components by default; add `'use client'` only when needed
- All protected API routes extract the token via `getAccessToken(request)` from `@/lib/api-auth`
- Forward `Authorization: Bearer <token>` to every backend call from API routes
- Use `cn()` from `@/lib/utils` for conditional Tailwind classes

## Architecture Notes

- **Shared packages:** `@veribuy/common` (guards, decorators, DTOs), `@veribuy/redis-cache` (Redis module), `@veribuy/shared-types` (cross-service types/events)
- **Inter-service HTTP:** Use a thin `*.service.ts` client with `fetch` + `x-internal-service` token + `AbortSignal.timeout()`; always fire-and-forget with `.catch(() => {})` for non-critical paths
- **Trust Lens flow:** evidence-service → trust-lens-service (checklist fulfillment) → listing-service (trustLensStatus) + user-service (verificationStatus). All calls are direct HTTP, not RabbitMQ (events defined in shared-types but not yet wired)
- **No RabbitMQ consumers exist yet** — `@EventPattern` / `ClientProxy` are not used in any service
- **Prisma clients** are per-service, generated into `node_modules/.prisma/<service>-client`
