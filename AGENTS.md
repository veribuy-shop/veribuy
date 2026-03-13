# AGENTS.md

Agent reference for the VeriBuy monorepo (pnpm workspaces + Turborepo).

## Stack

- **Backend:** NestJS 11, Prisma 6, PostgreSQL 17 (separate schema per service)
- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS 4
- **Infra:** RabbitMQ, Redis, MinIO, OpenTelemetry/Jaeger, Prometheus
- **Package manager:** pnpm@10.30.2, Node >=22
- **Ports:** Gateway 3000 · Auth 3001 · User 3002 · Listing 3003 · TrustLens 3004 · Evidence 3006 · Transaction 3007 · Notification 3008 · Web 3010

## Workspaces

| Filter name | Directory | Has Prisma |
|---|---|---|
| `@veribuy/gateway` | `gateway/` | No |
| `@veribuy/auth-service` | `services/auth-service/` | Yes |
| `@veribuy/user-service` | `services/user-service/` | Yes |
| `@veribuy/listing-service` | `services/listing-service/` | Yes |
| `@veribuy/trust-lens-service` | `services/trust-lens-service/` | Yes |
| `@veribuy/evidence-service` | `services/evidence-service/` | Yes |
| `@veribuy/transaction-service` | `services/transaction-service/` | Yes |
| `@veribuy/notification-service` | `services/notification-service/` | Yes |
| `@veribuy/web` (Next.js) | `web/` | No |
| `@veribuy/common` | `packages/common/` | No |
| `@veribuy/logger` | `packages/logger/` | No |
| `@veribuy/redis-cache` | `packages/redis-cache/` | No |
| `@veribuy/shared-types` | `packages/shared-types/` | No |
| `@veribuy/observability` | `packages/observability/` | No |

## Build / Lint / Test Commands

```bash
# Root (via Turborepo)
pnpm build                        # Build everything
pnpm lint                         # Lint everything
pnpm test                         # Test everything (Jest 29 + ts-jest)
pnpm prisma:generate              # Regenerate all Prisma clients
pnpm prisma:migrate               # Run all migrations

# Per-service (--filter takes package.json "name")
pnpm --filter @veribuy/listing-service build
pnpm --filter @veribuy/listing-service lint
pnpm --filter @veribuy/listing-service test
pnpm --filter @veribuy/listing-service test -- <file>          # single file
pnpm --filter @veribuy/listing-service test -- -t "test name"  # single test by name
pnpm --filter @veribuy/listing-service prisma:generate
pnpm --filter @veribuy/listing-service prisma:migrate

# Frontend
pnpm --filter @veribuy/web build
pnpm --filter @veribuy/web lint    # next lint

# Docker
pnpm docker:up    # full stack (infra + all services)
pnpm docker:down  # stop stack
```

- **After editing a Prisma schema always run `prisma:generate` for that service before building.**
- NestJS services build via `nest build`; shared packages build via `tsc`.
- No test files exist yet. Test runner is Jest 29 with ts-jest.
- NestJS `lint` script runs `eslint "{src,apps,libs,test}/**/*.ts" --fix` (config is inline in each service).

## Code Style

### TypeScript
- `strictNullChecks`, `noImplicitAny`, `strictBindCallApply` enabled in NestJS services
- Full `strict: true` in shared packages and Next.js
- NestJS requires `experimentalDecorators` + `emitDecoratorMetadata`
- Target: ES2022 (backend), ES2017 (frontend)
- Prefer `interface` for object shapes; use `type` for unions/primitives
### Imports
```typescript
// NestJS: external -> @veribuy/* -> relative (no path aliases)
import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, Public, CurrentUser } from '@veribuy/common';
import { RedisService } from '@veribuy/redis-cache';
import { PrismaService } from '../prisma/prisma.service';
// Prisma types: always from the per-service generated client
import { Listing, ListingStatus } from '.prisma/listing-client';

// Next.js: React/Next -> external -> internal with @/ alias
import Link from 'next/link';
import { cn } from '@/lib/utils';
```
- Prisma types come from `.prisma/<service>-client`, NOT from `@veribuy/shared-types`
### Naming
| What | Convention | Example |
|---|---|---|
| NestJS files | `*.controller.ts`, `*.service.ts`, `*.module.ts`, `*.dto.ts` | `listings.controller.ts` |
| Next.js files | `page.tsx`, `layout.tsx`, kebab-case components | `listing-card.tsx` |
| Classes / interfaces / enums | `PascalCase` | `CreateListingDto` |
| Variables / functions / methods | `camelCase` | `findBySeller` |
| Constants | `SCREAMING_SNAKE_CASE` | `ALLOWED_TRANSITIONS` |
| Prisma models | `PascalCase` | `EvidenceChecklist` |
| DB columns | `snake_case` via `@map()` | `@map("seller_id")` |
| DB tables | `snake_case` via `@@map()` | `@@map("listings")` |
### Formatting
- 2-space indentation, single quotes, semicolons required
- Trailing commas in multiline objects/arrays
- Double quotes in JSON only
### Error Handling
- Use NestJS HTTP exceptions directly: `NotFoundException`, `ForbiddenException`, `ConflictException`, `BadRequestException`, `UnauthorizedException`
- `AllExceptionsFilter` from `@veribuy/logger` catches unhandled exceptions, redacts sensitive fields
- Services throw exceptions directly — no try/catch wrapping in controllers
### DTOs & Validation
- DTOs use `class-validator` decorators (`@IsString()`, `@IsEnum()`, `@IsOptional()`)
- Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`
- Query DTOs extend `PaginationDto` from `@veribuy/common`
- `sellerId`/`userId` is **never** from request body — always from JWT via `@CurrentUser()`
### NestJS Patterns
- Controllers: `@UseGuards(JwtAuthGuard, RolesGuard)` at class level; `@Public()` to opt out
- Role restriction: `@Roles('SELLER', 'ADMIN')`
- UUID params: `@Param('id', ParseUUIDPipe)`
- Ownership: fetch resource, compare `ownerId === user.userId`, bypass if `user.role === 'ADMIN'`
- Parallel DB queries: `Promise.all()` for count + data in paginated endpoints
- All list endpoints return `PaginatedResponse<T>` from `@veribuy/common`
- Logging: `private readonly logger = new Logger(ServiceName.name)`
- Use explicit `select` in Prisma queries — never return full models to callers
### Service Bootstrap (`main.ts`)
Every NestJS service follows: `assertTlsInProduction()` -> `createLogger()` -> `helmet()` -> `enableCors()` -> `ValidationPipe` -> `AllExceptionsFilter` -> `listen()`.
Exception: Gateway skips `helmet()` and `AllExceptionsFilter`.
### Inter-Service Communication
- HTTP calls via thin client classes; authenticated with `x-internal-service` header + `crypto.timingSafeEqual()`
- Non-critical calls: fire-and-forget `.catch(() => {})`; critical calls: `AbortSignal.timeout()`
- No RabbitMQ consumers yet — event types defined in `@veribuy/shared-types` but not wired
### Security & Auth
- Frontend tokens: HttpOnly cookies only — never `localStorage`; fetch with `credentials: 'include'`
- Next.js middleware verifies JWT with `jose`; API routes use `getAccessToken()` from `@/lib/api-auth`
- Next.js API routes form a BFF layer — verify auth, forward to backend as `Authorization: Bearer`
### Caching (Redis)
- `@veribuy/redis-cache` provides `RedisService` with `get`/`set`/`del`/`exists`/`ttl`/`incr`/`decr`
- Keys: `listing:{id}` (300s), `profile:{userId}` (600s), `unread:{userId}` (60s)
- Always `redis.del(key)` after updates; fail-open on cache errors
### Prisma
- Each service owns `prisma/schema.prisma` with its own PostgreSQL schema namespace
- Generated clients go to `node_modules/.prisma/<service>-client`
- Index all foreign keys, status/enum fields, timestamp sort fields
- Dual URL: `url` (pooled) + `directUrl` (migrations); UUIDs everywhere (`@id @default(uuid())`)
### Next.js
- Server components by default; `'use client'` only when needed
- `cn()` from `@/lib/utils` (clsx + tailwind-merge) for conditional classes
- API routes verify auth and proxy to backend services (BFF pattern)

## Architecture Notes

- **Shared packages:** `@veribuy/common` (guards, decorators, DTOs), `@veribuy/redis-cache`, `@veribuy/logger` (Winston, exception filter, TLS enforcement), `@veribuy/shared-types` (enums, events, interfaces), `@veribuy/observability` (OTel — defined but not wired)
- **Trust Lens flow:** evidence-service -> trust-lens-service -> listing-service (trustLensStatus) + user-service (verificationStatus). All inter-service calls are direct HTTP.
- **Gateway:** pure HTTP proxy using native `fetch()` with `AbortSignal.timeout(30000)`; routes by URL prefix
- **No ESLint or Prettier config files** — style is enforced by convention only
- **Currency:** GBP throughout; **env vars:** mix of `process.env` and `ConfigService.get()`, no schema validation
