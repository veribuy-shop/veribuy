# VeriBuy

**AI-enabled, verification-led marketplace for electronic devices.**

VeriBuy reduces fraud, disputes, and low-trust pricing in the buying and selling of new and pre-owned electronics. Its core differentiator is **Trust Lens** — a pre-authentication workflow that verifies sellers and devices before listings go live.

## Architecture

| Service | Port | Stack |
|---|---|---|
| API Gateway | 3000 | NestJS 11 |
| Auth Service | 3001 | NestJS 11 + Prisma 7 |
| User Service | 3002 | NestJS 11 + Prisma 7 |
| Listing Service | 3003 | NestJS 11 + Prisma 7 |
| Trust Lens Service | 3004 | NestJS 11 + Prisma 7 |
| Evidence Service | 3006 | NestJS 11 + Prisma 7 |
| Transaction Service | 3007 | NestJS 11 + Prisma 7 |
| Notification Service | 3008 | NestJS 11 + Prisma 7 |
| Frontend | 3010 | Next.js 15 |

**Infrastructure:** PostgreSQL 17 · Redis 8.4 · RabbitMQ 4.0 · MinIO

## Quick Start (Docker Compose)

### Prerequisites

- Docker & Docker Compose v2

### Setup

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start everything — infra + all services
docker compose up -d --build
```

That's it. Docker Compose handles dependency installation, Prisma generation, migrations, and service startup inside each container.

| URL | What |
|---|---|
| http://localhost:3010 | Frontend |
| http://localhost:3000 | API Gateway |
| http://localhost:15672 | RabbitMQ Management (veribuy / veribuy_rabbit_dev) |
| http://localhost:9001 | MinIO Console (veribuy_minio / veribuy_minio_secret) |

### Local Development (optional)

Only needed if you want to run services outside Docker for faster iteration or IDE IntelliSense:

```bash
# Install Node.js 22+, pnpm 9+, Python 3.12+
pnpm install

# Start only infra in Docker
docker compose up -d postgres redis rabbitmq minio

# Generate Prisma clients + run migrations
pnpm prisma:generate
pnpm prisma:migrate

# Start all services in dev mode
pnpm dev
```

## Project Structure

```
veribuy/
├── gateway/              # API Gateway
├── services/
│   ├── auth-service/
│   ├── user-service/
│   ├── listing-service/
│   ├── trust-lens-service/
│   ├── evidence-service/
│   ├── transaction-service/
│   └── notification-service/
├── web/                  # Next.js frontend
├── packages/
│   └── shared-types/     # Shared TypeScript types
└── infra/                # K8s manifests (future)
```

## License

Proprietary — All rights reserved.
