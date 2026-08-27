# VeriBuy

VeriBuy is a verification-led marketplace for electronic devices.

## POC Architecture

```text
frontend/  Next.js 15 application and BFF, port 3010
backend/   NestJS modular monolith API, port 3000
postgres   one PostgreSQL database with logical domain schemas
redis      cache and short-lived application state
```

Authentication, users, listings, Trust Lens, evidence, transactions, and notifications are internal backend modules, not separate deployed services.

## Local Setup

Requirements: Node.js 22+, pnpm 10.30.2, and Docker Compose v2.

```bash
cp .env.example .env
pnpm install
pnpm docker:up
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

Existing named PostgreSQL and Redis volumes are reused. `pnpm seed` is optional and resets development data.

## Access

- Frontend: http://localhost:3010
- Backend: http://localhost:3000
- Health: http://localhost:3000/health
- Development Swagger: http://localhost:3000/docs

## Layout

```text
backend/
  prisma/       Prisma 7 schema and migrations
  src/          bootstrap, database, and shared infrastructure
  modules/      internal business modules
frontend/       Next.js application
packages/       shared libraries
scripts/        maintained TypeScript utilities
```

See `AGENTS.md` for database, security, and development conventions.

## Deploy (Render)

The repository includes a Render Blueprint (`render.yaml`) that provisions:

- **veribuy-backend** — NestJS API (Starter, Frankfurt)
- **veribuy-frontend** — Next.js frontend (Starter, Frankfurt)
- **veribuy-postgres** — PostgreSQL 17 (basic-256mb, Frankfurt)
- **veribuy-redis** — Render Key Value (free, internal only)

### First deploy

1. Push the repo to GitHub/GitLab.
2. In the Render Dashboard, create a new **Blueprint** and point it at the repo.
3. Render reads `render.yaml`, prompts for the `sync: false` secrets (Stripe, Resend, Cloudinary, IMEI keys), and provisions everything.
4. On first deploy the backend runs `prisma migrate deploy` automatically.

### Estimated monthly cost

| Resource | Plan | Approx. |
|---|---|---|
| Backend web service | Starter | $7 |
| Frontend web service | Starter | $7 |
| PostgreSQL | basic-256mb | ~$7 |
| Redis (Key Value) | Free | $0 |
| **Total** | | **~$21/mo** |

Free-tier Postgres exists but expires after 30 days and deletes data — not suitable for a POC with real orders.

### Secrets to prepare

Before the Blueprint sync you'll be prompted for:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `RESEND_API_KEY`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `IMEI_CHECK_API_KEY`, `IFREE_ICLOUD_API_KEY`

JWT secrets are generated automatically and shared between frontend and backend via the `veribuy-secrets` environment group.
