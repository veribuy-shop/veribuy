# AGENTS.md

Development guide for AI coding agents working in the VeriBuy codebase.

## Project Overview

VeriBuy is a monorepo using pnpm workspaces + Turborepo. It's an AI-enabled, verification-led marketplace for electronic devices with microservices architecture.

**Stack:**
- Backend: NestJS 11 + Prisma 7 + PostgreSQL 17
- Frontend: Next.js 15 (App Router) + React 19 + Tailwind CSS 4
- Infra: RabbitMQ 4.0, Redis 8.4, MinIO
- Package Manager: pnpm@10.30.2, Node.js >=22.0.0
- Logging: Winston + Loki + Promtail + Grafana
- Observability: OpenTelemetry, Prometheus, Jaeger

## Build, Lint & Test Commands

### Root (Turborepo)
```bash
pnpm dev                  # Watch mode for all services
pnpm build                # Build all packages
pnpm lint                 # Lint all packages
pnpm test                 # Run all tests
pnpm prisma:generate      # Generate Prisma clients for all services
pnpm prisma:migrate       # Run migrations for all services
```

### NestJS Services (auth, user, listing, trust-lens, evidence, transaction, notification)
```bash
cd services/<service-name>
pnpm dev                  # Start service in watch mode
pnpm build                # Build service (outputs to dist/)
pnpm start                # Run built service
pnpm lint                 # ESLint with autofix
pnpm test                 # Run Jest tests
pnpm test -- <file>       # Run single test file
pnpm test -- -t "test name"  # Run specific test by name
pnpm prisma:generate      # Generate Prisma client
pnpm prisma:migrate       # Run Prisma migrations
pnpm prisma:studio        # Open Prisma Studio GUI
```

### API Gateway
```bash
cd gateway
pnpm dev                  # Start gateway in watch mode
pnpm build                # Build gateway
pnpm lint                 # ESLint with autofix
pnpm test                 # Run tests
```

### Frontend (web)
```bash
cd web
pnpm dev                  # Start Next.js dev server (Turbopack enabled)
pnpm build                # Build Next.js app
pnpm start                # Start production server
pnpm lint                 # Run Next.js linter
```

### Shared Types
```bash
cd packages/shared-types
pnpm build                # Compile TypeScript to dist/
pnpm dev                  # Watch mode for type changes
```

### Docker Commands
```bash
pnpm docker:up            # Start all services in Docker
pnpm docker:down          # Stop all Docker containers
pnpm docker:build         # Rebuild Docker images
```

## Docker & Deployment

### Docker Architecture

**VeriBuy uses a multi-file Docker Compose setup:**

- `docker-compose.yml` - Main production setup with all services
- `docker-compose.infra.yml` - Infrastructure only (Postgres, Redis, RabbitMQ, MinIO, observability stack)
- `docker-compose.dev.yml` - Development overrides
- `docker-compose.override.yml` - Local overrides (gitignored)

### Dockerfile Structure

**Shared NestJS Dockerfile (`Dockerfile.nestjs`):**
- Multi-stage build for optimal image size
- Supports pnpm workspace monorepo
- Builds workspace packages (`@veribuy/common`, `@veribuy/redis-cache`) before service
- Generates Prisma clients at build time
- Production stage runs with NODE_ENV=production

**Key Dockerfile features:**
```dockerfile
# Build workspace packages first (important!)
RUN pnpm --filter @veribuy/common build || true
RUN pnpm --filter @veribuy/redis-cache build || true

# Then build the service
WORKDIR /app/services/${SERVICE_NAME}
RUN pnpm build
```

### Environment Variables

**All services require these environment variables in Docker:**

```yaml
# Database (service connects to 'postgres' hostname in Docker network)
DATABASE_URL: postgresql://veribuy:veribuy_dev_password@postgres:5432/veribuy?schema=<service_schema>
POSTGRES_HOST: postgres
POSTGRES_PORT: 5432
POSTGRES_USER: veribuy
POSTGRES_PASSWORD: veribuy_dev_password
POSTGRES_DB: veribuy

# Redis (required for services using @veribuy/redis-cache)
REDIS_HOST: redis
REDIS_PORT: 6379
REDIS_DB: 0

# RabbitMQ
RABBITMQ_URL: amqp://veribuy:veribuy_rabbit_dev@rabbitmq:5672

# MinIO
MINIO_ENDPOINT: minio

# OpenTelemetry/Jaeger
JAEGER_ENDPOINT: http://jaeger:4318

# Service Port
PORT: <service_port>
```

**Services using Redis caching:**
- `user-service` - Caches user profiles
- `listing-service` - Caches individual listings
- `notification-service` - Caches unread message counts

### Docker Commands

```bash
# Start infrastructure only (Postgres, Redis, RabbitMQ, MinIO, observability)
docker compose -f docker-compose.infra.yml up -d

# Start all services (infra + microservices + frontend)
docker compose up -d

# Build and start all services
docker compose up --build -d

# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes all data)
docker compose down -v

# View logs for a specific service
docker compose logs -f user-service

# View logs for all services
docker compose logs -f

# Rebuild a specific service
docker compose build user-service

# Restart a specific service
docker compose restart user-service

# Execute command in running container
docker compose exec user-service sh
```

### Service Dependencies

**All NestJS services depend on (must wait for health checks):**
- `postgres` - PostgreSQL database
- `redis` - Redis cache (for services using `@veribuy/redis-cache`)
- `rabbitmq` - RabbitMQ message broker
- `jaeger` - OpenTelemetry collector

**Example dependency configuration:**
```yaml
depends_on:
  postgres:
    condition: service_healthy
  redis:
    condition: service_healthy
  rabbitmq:
    condition: service_healthy
  jaeger:
    condition: service_healthy
```

### Health Checks

**All infrastructure services include health checks:**

```yaml
# Postgres
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U veribuy"]
  interval: 10s
  timeout: 5s
  retries: 5

# Redis
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 5s
  retries: 5

# RabbitMQ
healthcheck:
  test: ["CMD", "rabbitmq-diagnostics", "ping"]
  interval: 10s
  timeout: 5s
  retries: 5
```

### Building Individual Services

```bash
# Build a specific service from root directory
docker build -f Dockerfile.nestjs \
  --build-arg SERVICE_NAME=user-service \
  -t veribuy-user-service:latest .

# Run the built image
docker run -p 3002:3002 \
  --env-file .env \
  -e DATABASE_URL=postgresql://... \
  veribuy-user-service:latest
```

### Common Docker Issues

**Issue: Workspace packages not found**
- Solution: The shared `Dockerfile.nestjs` now builds workspace packages first
- Ensure `pnpm --filter @veribuy/common build` runs before service build

**Issue: Prisma client not generated**
- Solution: `npx prisma generate` runs automatically in build stage
- For production stage, it runs again to create correct symlinks

**Issue: Service can't connect to Redis/Postgres**
- Solution: Check service is using Docker network hostnames (`redis`, `postgres`)
- Verify `depends_on` with `condition: service_healthy`

**Issue: Redis connection refused**
- Solution: Ensure Redis environment variables are set correctly:
  - `REDIS_HOST=redis` (not `localhost`)
  - `REDIS_PORT=6379`
  - `REDIS_DB=0`

### Production Deployment Notes

**For production deployments:**

1. Use production-ready environment variables (update `.env`)
2. Set strong passwords for all services
3. Enable TLS/SSL for Postgres, Redis, RabbitMQ
4. Use managed services (AWS RDS, ElastiCache, etc.) instead of containerized databases
5. Implement proper secrets management (AWS Secrets Manager, HashiCorp Vault)
6. Use container orchestration (Kubernetes, ECS, etc.)
7. Enable authentication for Redis (`REDIS_PASSWORD`)
8. Configure proper CORS origins (`ALLOWED_ORIGINS`)
9. Use production JWT secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`)
10. Enable rate limiting with distributed state (Redis-based)

## Code Style Guidelines

### TypeScript Configuration
- **Strict mode enabled** across all packages
- Target: ES2022 (NestJS), ES2017 (Next.js)
- Use `strictNullChecks`, `noImplicitAny`, `strictBindCallApply`
- NestJS requires `experimentalDecorators` and `emitDecoratorMetadata`

### Import Patterns

**NestJS Services:**
```typescript
// External dependencies first (grouped)
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

// Internal dependencies (relative paths)
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
```

**Next.js (Frontend):**
```typescript
// React/Next imports first
import Link from 'next/link';
import type { Metadata } from 'next';

// Internal imports using @ alias
import { Header } from '@/components/layout/header';
import { cn } from '@/lib/utils';
```

**Path Aliases:**
- Next.js: `@/*` maps to root (`./`)
- NestJS: No aliases, use relative paths

### Naming Conventions

**Files:**
- NestJS: `*.controller.ts`, `*.service.ts`, `*.module.ts`, `*.dto.ts`, `*.strategy.ts`
- Next.js: `page.tsx` (routes), `layout.tsx` (layouts), kebab-case for components
- Shared: `*.interface.ts`, `*.enum.ts`, `*.events.ts`

**Folders:**
- Feature-based: `auth/`, `user/`, `listing/`
- Nested DTOs: `auth/dto/register.dto.ts`
- Nested strategies: `auth/strategies/jwt.strategy.ts`

**Variables & Functions:**
- camelCase for variables, functions, methods
- PascalCase for classes, interfaces, enums, React components
- SCREAMING_SNAKE_CASE for constants

**Database (Prisma):**
- Models: PascalCase (`User`, `RefreshToken`)
- Fields: camelCase (`userId`, `createdAt`)
- Table names: snake_case via `@@map("users")`
- Column names: snake_case via `@map("user_id")`

### Formatting

**Indentation:** 2 spaces (TypeScript, JSON, YAML)
**Quotes:** Single quotes for TypeScript, double for JSON
**Semicolons:** Required (NestJS standard)
**Line length:** No strict limit, prefer readability
**Trailing commas:** Use in multiline objects/arrays

### Type Definitions

**Prefer interfaces over type aliases for objects:**
```typescript
// Good
export interface User {
  id: string;
  email: string;
}

// Use type for unions/primitives
export type UserRole = 'BUYER' | 'SELLER' | 'ADMIN';
```

**Always type function returns explicitly:**
```typescript
async register(dto: RegisterDto): Promise<AuthResponse> {
  // ...
}
```

**Use DTOs with class-validator for validation:**
```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

### Error Handling

**NestJS: Use built-in HTTP exceptions:**
```typescript
import { UnauthorizedException, ConflictException } from '@nestjs/common';

if (existing) {
  throw new ConflictException('Email already registered');
}

if (!user) {
  throw new UnauthorizedException('Invalid credentials');
}
```

**Common exceptions:**
- `BadRequestException` (400)
- `UnauthorizedException` (401)
- `ForbiddenException` (403)
- `NotFoundException` (404)
- `ConflictException` (409)
- `InternalServerErrorException` (500)

**Next.js: Use try-catch with error states:**
```typescript
try {
  const response = await fetch('/api/data');
  if (!response.ok) throw new Error('Failed to fetch');
  // ...
} catch (error) {
  console.error('Error:', error);
  // Handle UI error state
}
```

### NestJS Patterns

**Module structure:**
```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    FeatureModule,
  ],
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [FeatureService], // If used by other modules
})
export class AppModule {}
```

**Controller pattern:**
```typescript
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

**Service pattern with dependency injection:**
```typescript
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}
}
```

**Global ValidationPipe in main.ts:**
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,           // Strip non-whitelisted properties
    forbidNonWhitelisted: true, // Throw error if extra properties
    transform: true,            // Auto-transform to DTO instances
  }),
);
```

### Prisma Patterns

**Schema organization:**
- Each service has its own schema (e.g., `auth`, `users`, `listings`)
- Use `@@schema("schema_name")` directive
- Use `@map()` for snake_case columns
- Use `@@map()` for snake_case tables

**Service pattern:**
```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### Next.js Patterns

**Server Components (default):**
```typescript
// app/page.tsx
export default function HomePage() {
  return <div>Content</div>;
}
```

**Client Components:**
```typescript
'use client';

import { useState } from 'react';
// ...
```

**Metadata:**
```typescript
export const metadata: Metadata = {
  title: 'VeriBuy — Verified Electronics Marketplace',
  description: '...',
};
```

**Styling with Tailwind + CSS variables:**
```tsx
<div className="bg-[var(--color-primary)] text-white px-4 py-2">
  Content
</div>
```

**Use `cn()` helper for conditional classes:**
```typescript
import { cn } from '@/lib/utils';

<div className={cn('base-class', isActive && 'active-class')} />
```

### Logging Patterns

**All NestJS services use Winston for structured logging:**

```typescript
// In main.ts
import { createLogger } from './logger.config';

async function bootstrap() {
  const logger = createLogger('service-name');
  const app = await NestFactory.create(AppModule, { logger });
  
  logger.log('Service started', 'Bootstrap');
  logger.error('Something went wrong', 'ErrorHandler');
  logger.warn('Warning message', 'Validator');
}
```

**Log output locations:**
- Console: Human-readable, colored
- JSON file: `/tmp/veribuy-{service-name}.json` (for Loki aggregation)
- Error file: `/tmp/veribuy-{service-name}-error.json`

**View logs:**
```bash
# Using CLI tool
./scripts/view-logs.sh -s auth -n 20      # Last 20 logs
./scripts/view-logs.sh -s auth -f          # Follow logs
./scripts/view-logs.sh -l error            # Filter by level

# In Grafana
http://localhost:3011 → VeriBuy Logs dashboard
```

### Security Conventions

**All services are secured with authentication, authorization, and rate limiting.**

#### Authentication & Authorization

**All controllers use guards from `@veribuy/common`:**
```typescript
import { JwtAuthGuard, RolesGuard, Public, Roles, CurrentUser } from '@veribuy/common';

@Controller('listings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ListingsController {
  // Public endpoints (no authentication required)
  @Public()
  @Get()
  async findAll(@Query() pagination: PaginationDto) {
    return this.service.findAll(pagination);
  }

  // Protected endpoint - requires authentication
  @Get('my-listings')
  @Roles('SELLER')
  async getMyListings(
    @CurrentUser() user: { userId: string; role: string },
    @Query() pagination: PaginationDto,
  ) {
    return this.service.findBySeller(user.userId, pagination);
  }

  // Admin-only endpoint
  @Patch(':id/admin-action')
  @Roles('ADMIN')
  async adminAction(@Param('id') id: string) {
    return this.service.performAdminAction(id);
  }
}
```

**Guard behavior:**
- `JwtAuthGuard`: Validates JWT tokens from `Authorization: Bearer <token>` header
- `RolesGuard`: Checks user role against `@Roles()` decorator
- `@Public()`: Bypasses authentication (for login, register, public listings)
- `@CurrentUser()`: Extracts authenticated user from request

**Available roles:**
- `BUYER`: Can purchase items, create orders
- `SELLER`: Can create listings, manage sales
- `ADMIN`: Full access to all resources

#### Ownership Verification Pattern

**Always verify ownership in service methods before allowing operations:**

```typescript
@Injectable()
export class ListingsService {
  async updateListing(
    listingId: string,
    updateData: UpdateListingDto,
    user: { userId: string; role: string },
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Verify ownership (unless admin)
    if (user.role !== 'ADMIN' && listing.sellerId !== user.userId) {
      throw new ForbiddenException('You can only update your own listings');
    }

    return this.prisma.listing.update({
      where: { id: listingId },
      data: updateData,
    });
  }
}
```

**Common ownership patterns:**
- Listings: `sellerId === user.userId`
- Orders: `buyerId === user.userId` OR `sellerId === user.userId`
- Profiles: `userId === user.userId`
- Evidence packs: `sellerId === user.userId`

#### Rate Limiting

**All services use global rate limiting:**
```typescript
// In app.module.ts
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,  // 60 seconds
        limit: 10,   // 10 requests per minute per IP
      },
    ]),
  ],
})
```

**Override rate limits for specific endpoints:**
```typescript
@Throttle({ default: { limit: 3, ttl: 60000 } })  // 3 requests per minute
@Post('send-verification-email')
async sendVerificationEmail() {
  // ...
}
```

#### CORS & Security Headers

**All services use Helmet for security headers and CORS:**
```typescript
// In main.ts
app.use(helmet());

app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3010',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

**Environment variables:**
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins (e.g., `http://localhost:3010,https://veribuy.com`)

### Performance Conventions

**All services follow performance best practices for pagination, caching, database queries, and indexing.**

#### Pagination

**All list endpoints return `PaginatedResponse<T>` from `@veribuy/common`:**

```typescript
import { PaginationDto, PaginatedResponse } from '@veribuy/common';

@Controller('listings')
export class ListingsController {
  @Get()
  async findAll(@Query() pagination: PaginationDto): Promise<PaginatedResponse<Listing>> {
    return this.service.findAll(pagination);
  }
}

@Injectable()
export class ListingsService {
  async findAll(pagination: PaginationDto): Promise<PaginatedResponse<Listing>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    // Run queries in parallel for performance
    const [data, total] = await Promise.all([
      this.prisma.listing.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.listing.count(),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
```

**Pagination defaults:**
- `page`: 1
- `limit`: 10
- Always include `total` count for UI
- Always use `Promise.all()` for parallel queries

**Query parameters:**
- `?page=1&limit=20` - Get first page with 20 items
- `?page=2` - Get second page with default limit (10)

#### Caching Strategy

**Use `@veribuy/redis-cache` for hot paths (frequently accessed data):**

```typescript
import { RedisService } from '@veribuy/redis-cache';

@Injectable()
export class ListingsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async findOne(id: string) {
    const cacheKey = `listing:${id}`;
    
    // Try cache first
    const cached = await this.redis.get<Listing>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Cache miss - fetch from database
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });
    
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    
    // Cache for 5 minutes (300 seconds)
    await this.redis.set(cacheKey, listing, 300);
    
    return listing;
  }

  async updateStatus(id: string, status: ListingStatus) {
    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status },
    });
    
    // CRITICAL: Invalidate cache after updates
    await this.redis.del(`listing:${id}`);
    
    return updated;
  }
}
```

**Cache key patterns:**
- `listing:{id}` - Individual listing cache
- `profile:{userId}` - User profile cache
- `unread:{userId}` - Unread message count cache
- `order:{id}` - Order cache

**TTL guidelines:**
- High-frequency reads (unread counts): 1-5 minutes (60-300s)
- Medium-frequency reads (listings, orders): 5-10 minutes (300-600s)
- Low-frequency reads (user profiles): 10-30 minutes (600-1800s)

**CRITICAL: Always invalidate cache on updates/deletes:**
```typescript
// Update
await this.prisma.resource.update({ where: { id }, data });
await this.redis.del(`resource:${id}`);  // ← REQUIRED

// Delete
await this.prisma.resource.delete({ where: { id } });
await this.redis.del(`resource:${id}`);  // ← REQUIRED
```

#### Database Query Optimization

**Avoid N+1 queries by using explicit `select` in `include`:**

```typescript
// ❌ BAD: Fetches all fields from related tables
const profile = await this.prisma.profile.findUnique({
  where: { userId },
  include: { address: true },
});

// ✅ GOOD: Only fetch needed fields
const profile = await this.prisma.profile.findUnique({
  where: { userId },
  include: {
    address: {
      select: {
        id: true,
        line1: true,
        line2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
      },
    },
  },
});
```

**Why explicit selects matter:**
- Reduces data transfer from database
- Prevents unnecessary field fetching
- Improves query performance
- Makes data dependencies explicit

**Pattern for nested includes:**
```typescript
const verificationRequest = await this.prisma.verificationRequest.findUnique({
  where: { id },
  include: {
    evidenceChecklist: {
      select: {
        id: true,
        type: true,
        description: true,
        required: true,
        fulfilled: true,
        fulfilledAt: true,
        createdAt: true,
      },
    },
    identifierValidation: {
      select: {
        id: true,
        imeiProvided: true,
        imeiValid: true,
        serialProvided: true,
        serialValid: true,
        icloudLocked: true,
        reportedStolen: true,
        blacklisted: true,
        verifiedAt: true,
        createdAt: true,
      },
    },
  },
});
```

#### Database Indexes

**All Prisma schemas include performance indexes:**

```prisma
model Listing {
  id            String   @id @default(uuid())
  sellerId      String   @map("seller_id")
  status        ListingStatus
  deviceType    String   @map("device_type")
  publishedAt   DateTime? @map("published_at")
  createdAt     DateTime @default(now()) @map("created_at")
  
  // Single-column indexes
  @@index([sellerId])        // For queries by seller
  @@index([status])          // For filtering by status
  @@index([deviceType])      // For filtering by device type
  @@index([createdAt])       // For sorting by date
  
  // Composite indexes for common query patterns
  @@index([sellerId, status])           // Seller's listings by status
  @@index([status, publishedAt])        // Active listings by publish date
  @@index([deviceType, status, createdAt])  // Device listings by status, sorted by date
  
  @@schema("listings")
  @@map("listings")
}
```

**Indexing guidelines:**
- Index all foreign keys
- Index all status/enum fields
- Index timestamp fields used for sorting
- Create composite indexes for common query patterns
- Index fields used in `WHERE`, `ORDER BY`, and `JOIN` clauses

## Frontend Security Conventions

**The Next.js frontend follows strict security patterns to protect user data and prevent common vulnerabilities.**

### Authentication & Session Management

**All authentication uses HttpOnly cookies instead of localStorage to prevent XSS attacks.**

#### Token Storage Pattern

```typescript
// ✅ GOOD: HttpOnly cookies (in API routes)
const response = NextResponse.json({ user: data.user });

response.cookies.set('accessToken', data.accessToken, {
  httpOnly: true,                          // Not accessible via JavaScript
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict',                      // CSRF protection
  maxAge: 15 * 60,                         // 15 minutes
  path: '/',
});

response.cookies.set('refreshToken', data.refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60,                // 7 days
  path: '/',
});

// ❌ BAD: localStorage (NEVER do this)
localStorage.setItem('accessToken', token); // Vulnerable to XSS
```

**Why HttpOnly cookies:**
- JavaScript cannot access them (XSS protection)
- Automatically sent with requests (no manual header management)
- Supports secure flag for HTTPS-only transmission
- SameSite attribute prevents CSRF attacks

#### Authentication Context Pattern

**Frontend auth context (`/web/lib/auth-context.tsx`) does NOT store tokens:**

```typescript
'use client';

import { createContext, useContext, useState, useEffect } from 'react';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify session with backend (tokens in HttpOnly cookies)
    const loadUser = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          credentials: 'include', // ← Include cookies
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user); // Only store non-sensitive user data
        }
      } catch (error) {
        console.error('Failed to verify session:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // ← Include cookies
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    setUser(data.user); // Tokens are in cookies, not returned
  };

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include', // ← Clears cookies
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**Key principles:**
- NEVER store tokens in component state or localStorage
- Only store non-sensitive user data (name, email, role)
- Always use `credentials: 'include'` in fetch calls
- Let backend manage token lifecycle

### Route Protection with Middleware

**Use Next.js middleware (`/web/middleware.ts`) to protect routes:**

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get access token from cookies
  const accessToken = request.cookies.get('accessToken')?.value;

  // Protected routes
  const protectedRoutes = ['/dashboard', '/profile', '/settings', '/orders'];
  const adminRoutes = ['/admin'];

  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));

  // Redirect to login if no token
  if ((isProtectedRoute || isAdminRoute) && !accessToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify token with backend
  if ((isProtectedRoute || isAdminRoute) && accessToken) {
    const { valid, user } = await verifyToken(accessToken);

    if (!valid) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('accessToken');
      response.cookies.delete('refreshToken');
      return response;
    }

    // Check admin access
    if (isAdminRoute && user?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*', '/admin/:path*', '/api/:path*'],
};
```

**Middleware responsibilities:**
- Verify authentication before rendering protected pages
- Redirect unauthenticated users to login
- Enforce role-based access control (e.g., admin-only routes)
- Clear invalid tokens
- Preserve intended destination with redirect parameter

### API Route Authorization

**All protected API routes MUST forward authorization headers to backend services.**

#### Auth Helper Utility

**Use `/web/lib/api-auth.ts` for consistent authorization:**

```typescript
import { NextRequest, NextResponse } from 'next/server';

export function getAccessToken(request: NextRequest): { token: string } | { error: NextResponse } {
  const accessToken = request.cookies.get('accessToken')?.value;

  if (!accessToken) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized - No access token' },
        { status: 401 }
      ),
    };
  }

  return { token: accessToken };
}

export function createAuthHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}
```

#### Protected API Route Pattern

**Apply this pattern to ALL protected API routes:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';

const SERVICE_URL = process.env.SERVICE_URL || 'http://service:port';

export async function POST(request: NextRequest) {
  try {
    // 1. Extract and validate access token
    const authResult = getAccessToken(request);
    if ('error' in authResult) {
      return authResult.error; // Return 401 if no token
    }

    const body = await request.json();

    // 2. Forward request to backend WITH authorization header
    const response = await fetch(`${SERVICE_URL}/endpoint`, {
      method: 'POST',
      headers: createAuthHeaders(authResult.token), // ← Authorization header
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Request failed' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Authorization rules by route type:**

**Protected routes (require auth):**
- User profile operations: `/api/users/[userId]/profile`
- Order management: `/api/orders/*`, `/api/checkout/*`
- Listing creation/updates: `/api/listings` (POST/PUT/DELETE)
- Admin operations: `/api/admin/*`
- Evidence uploads: `/api/evidence`
- Messages: `/api/messages/*`
- Trust Lens operations: `/api/trust-lens`

**Public routes (no auth required):**
- Authentication: `/api/auth/login`, `/api/auth/register`
- Public listing views: `/api/listings` (GET), `/api/listings/[id]` (GET)
- Webhooks: `/api/webhooks/*` (use signature verification instead)

**Example: Public listing GET with protected POST:**

```typescript
// /web/app/api/listings/route.ts
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';

const LISTING_SERVICE_URL = process.env.LISTING_SERVICE_URL || 'http://listing-service:3003';

// Public - anyone can view listings
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString();

  const response = await fetch(`${LISTING_SERVICE_URL}/listings?${queryString}`, {
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await response.json();
  return NextResponse.json(data);
}

// Protected - requires authentication
export async function POST(request: NextRequest) {
  // Extract token
  const authResult = getAccessToken(request);
  if ('error' in authResult) {
    return authResult.error;
  }

  const body = await request.json();

  // Forward with auth header
  const response = await fetch(`${LISTING_SERVICE_URL}/listings`, {
    method: 'POST',
    headers: createAuthHeaders(authResult.token),
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: 201 });
}
```

#### File Upload with Authorization

**For multipart/form-data uploads:**

```typescript
import { getAccessToken } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  // Extract token
  const authResult = getAccessToken(request);
  if ('error' in authResult) {
    return authResult.error;
  }

  const formData = await request.formData();

  // For FormData, set Authorization header separately
  const response = await fetch(`${SERVICE_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authResult.token}`, // Don't set Content-Type
    },
    body: formData, // Browser sets Content-Type with boundary
  });

  const data = await response.json();
  return NextResponse.json(data);
}
```

### Token Refresh Mechanism

**Implement automatic token refresh to avoid forcing re-login:**

#### Refresh Endpoint

**`/web/app/api/auth/refresh/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refreshToken')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { message: 'No refresh token' },
        { status: 401 }
      );
    }

    // Call backend refresh endpoint
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Clear invalid tokens
      const errorResponse = NextResponse.json(data, { status: response.status });
      errorResponse.cookies.delete('accessToken');
      errorResponse.cookies.delete('refreshToken');
      return errorResponse;
    }

    // Set new access token
    const nextResponse = NextResponse.json({ user: data.user });

    nextResponse.cookies.set('accessToken', data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60, // 15 minutes
      path: '/',
    });

    return nextResponse;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
```

#### Verify with Auto-Refresh

**`/web/app/api/auth/verify/route.ts` checks token and auto-refreshes if expired:**

```typescript
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('accessToken')?.value;

  if (!accessToken) {
    return NextResponse.json({ message: 'No access token' }, { status: 401 });
  }

  // Verify with backend
  const response = await fetch(`${AUTH_SERVICE_URL}/auth/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    // Access token invalid/expired, try refresh
    const refreshToken = request.cookies.get('refreshToken')?.value;

    if (refreshToken) {
      const refreshResponse = await fetch(`${AUTH_SERVICE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        const nextResponse = NextResponse.json({ user: refreshData.user });

        // Set new access token
        nextResponse.cookies.set('accessToken', refreshData.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 15 * 60,
          path: '/',
        });

        return nextResponse;
      }
    }

    // Both tokens failed, clear cookies
    const errorResponse = NextResponse.json(
      { message: 'Invalid or expired token' },
      { status: 401 }
    );
    errorResponse.cookies.delete('accessToken');
    errorResponse.cookies.delete('refreshToken');
    return errorResponse;
  }

  const data = await response.json();
  return NextResponse.json({ user: data });
}
```

**Token refresh flow:**
1. Frontend calls `/api/auth/verify` on mount
2. If access token expired, automatically uses refresh token
3. New access token set in cookie
4. User session continues seamlessly
5. If refresh token also expired, redirect to login

### Security Headers

**Configure comprehensive security headers in `/web/next.config.ts`:**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY', // Prevent clickjacking
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff', // Prevent MIME sniffing
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: http:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.stripe.com http://localhost:*",
              "frame-src 'self' https://js.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

**Security header purposes:**
- `X-Frame-Options: DENY` - Prevents iframe embedding (clickjacking protection)
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing attacks
- `Referrer-Policy` - Controls referrer information leakage
- `Permissions-Policy` - Restricts browser features (camera, microphone, etc.)
- `Content-Security-Policy` - Comprehensive XSS protection

**CSP directives explained:**
- `default-src 'self'` - Only allow resources from same origin by default
- `script-src` - Allow scripts from self, inline (Tailwind), and Stripe SDK
- `connect-src` - Allow API calls to self, Stripe, and localhost (dev)
- `frame-src` - Allow iframes from Stripe only
- `object-src 'none'` - Block plugins (Flash, Java, etc.)
- `frame-ancestors 'none'` - Prevent embedding in iframes
- `upgrade-insecure-requests` - Auto-upgrade HTTP to HTTPS

**When adding third-party services:**
1. Add domains to appropriate CSP directive
2. Test in development first
3. Use CSP reporting to catch violations
4. Be as restrictive as possible

### Logout Implementation

**`/web/app/api/auth/logout/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    );

    // Clear authentication cookies
    response.cookies.delete('accessToken');
    response.cookies.delete('refreshToken');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Frontend logout flow:**

```typescript
const logout = async () => {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    setUser(null);
    router.push('/');
  }
};
```

### Environment Variables

**Frontend environment variables in `/web/.env.local`:**

```bash
# Backend service URLs (server-side only)
AUTH_SERVICE_URL=http://localhost:3001
USER_SERVICE_URL=http://localhost:3002
LISTING_SERVICE_URL=http://localhost:3003
TRANSACTION_SERVICE_URL=http://localhost:3007
EVIDENCE_SERVICE_URL=http://localhost:3006
TRUST_LENS_SERVICE_URL=http://localhost:3004
NOTIFICATION_SERVICE_URL=http://localhost:3008

# Public environment variables (accessible in browser)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3010

# Security (production)
NODE_ENV=production
ALLOWED_ORIGINS=https://veribuy.com,https://www.veribuy.com
```

**Important:**
- NEVER expose backend service URLs to the browser
- Use `NEXT_PUBLIC_` prefix ONLY for truly public data
- Backend service URLs are accessed via API routes (server-side)
- Validate `ALLOWED_ORIGINS` in production

### Security Best Practices Summary

**DO:**
- ✅ Use HttpOnly cookies for authentication tokens
- ✅ Forward Authorization headers from frontend API routes to backend
- ✅ Implement route protection with middleware
- ✅ Validate tokens on every protected route
- ✅ Use `credentials: 'include'` in all authenticated fetch calls
- ✅ Set comprehensive security headers (CSP, X-Frame-Options, etc.)
- ✅ Implement token refresh for seamless UX
- ✅ Clear tokens on logout
- ✅ Use HTTPS in production (secure cookies)
- ✅ Validate user input on both frontend and backend
- ✅ Let backend enforce authorization (ownership, roles)

**DON'T:**
- ❌ Store tokens in localStorage or sessionStorage
- ❌ Expose tokens in URL parameters
- ❌ Skip authorization checks in API routes
- ❌ Trust client-side validation alone
- ❌ Expose backend service URLs to browser
- ❌ Use `NEXT_PUBLIC_` for sensitive configuration
- ❌ Disable security headers in production
- ❌ Allow admin access without role verification
- ❌ Return sensitive data in error messages
- ❌ Skip CORS configuration in backend services

**Common vulnerabilities prevented:**
- XSS (Cross-Site Scripting) - HttpOnly cookies + CSP
- CSRF (Cross-Site Request Forgery) - SameSite cookies
- Clickjacking - X-Frame-Options
- Session hijacking - Secure cookies + short token TTL
- Unauthorized access - Middleware + API route authorization
- Data exposure - Backend ownership verification

## Additional Notes

- **Port allocation:** Gateway (3000), Auth (3001), User (3002), Listing (3003), Trust Lens (3004), Device Verification (3005), Evidence (3006), Transaction (3007), Notification (3008), Web (3010)
- **Database:** PostgreSQL 17 with separate schemas per service
- **Authentication:** JWT with refresh tokens (stored in database)
- **Password hashing:** bcryptjs with salt rounds = 12
- **CORS:** Enabled globally in all NestJS services
- **Shared packages:** 
  - `@veribuy/shared-types` - Cross-service types/enums
  - `@veribuy/common` - Guards, decorators, DTOs (JWT auth, RBAC, pagination)
  - `@veribuy/redis-cache` - Redis caching module
- **Testing:** Jest 29 with ts-jest (tests not yet implemented)
- **Redis caching:** Used in user-service, listing-service, notification-service
- **Security:** All services use JWT authentication, role-based access control, rate limiting, and Helmet security headers
- **Performance:** Pagination on all list endpoints, Redis caching on hot paths, database indexes on all foreign keys and common query patterns

