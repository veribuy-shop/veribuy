# VeriBuy

VeriBuy is a high-trust, verification-led marketplace for pre-owned and refurbished consumer electronics. It combines automated device diagnostic checks (**TrustLens**), escrow-backed financial protection, and automated Royal Mail logistics fulfillment into a unified platform.

---

## Key Features

- **TrustLens Hardware Diagnostics & Verification:** Real-time IMEI/serial validation, activation lock checks, blacklisting status, and condition grading.
- **Automated Device Weight Mapping & Royal Mail Logistics:** Dynamic device hardware profiling, automatic parcel format classification (`SMALL_PARCEL` vs `MEDIUM_PARCEL`), batch weight scaling for bulk quantities, and Royal Mail rate calculation (Tracked 24, Tracked 48, Special Delivery 1pm) with remote UK postcode surcharge detection.
- **Drop-Off Center & Paperless Fulfillment:** Generation of standard 4x6" PDF shipping labels (with 2D DataMatrix and S10 barcodes) and digital Post Office counter QR codes for paperless drop-off and instant Proof of Postage.
- **Escrow-Backed Buyer Protection:** Funds remain safely locked in escrow until the buyer inspects and approves the delivered device (or 48-hour auto-release).
- **Business Accounts & Bulk Listings:** Support for business organizations to list bulk inventory with seller-covered free shipping options while preserving buyer protection guarantees.

---

## Architecture

VeriBuy is structured as a TypeScript monorepo managed with `pnpm` workspaces and Turborepo:

```text
├── packages/
│   ├── common/         # Universal domain models, weight catalog, Royal Mail rate engine, DTOs
│   ├── logger/         # Structured logging utilities
│   └── redis-cache/    # Distributed Redis caching helpers
├── backend/            # NestJS 11 modular monolith API (Port 3000)
│   ├── prisma/         # Prisma 7 schema, PostgreSQL logical schemas, and migrations
│   ├── modules/        # Business modules: auth, users, listings, trust-lens, evidence, transactions, notifications
│   └── src/            # Core bootstrap, database service, and interceptors
├── frontend/           # Next.js 15 App Router application and BFF (Port 3010)
│   ├── app/            # Routes, React Server Components, and BFF endpoints
│   └── lib/            # Client utilities, sanitizers, fee calculators, auth helpers
```

---

## Getting Started

### Prerequisites

- **Node.js:** `v22.0.0+`
- **Package Manager:** `pnpm 10.30.2+`
- **Container Runtime:** Docker & Docker Compose v2+

### Quickstart

1. **Clone the repository and install dependencies:**
   ```bash
   git clone https://github.com/veribuy-shop/veribuy.git
   cd VeriBuy
   pnpm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   *Fill in required local development credentials (see [Security & Environment Variables](#security--environment-variables)).*

3. **Start local database and cache containers:**
   ```bash
   pnpm docker:up
   ```

4. **Initialize database schema & run migrations:**
   ```bash
   pnpm prisma:generate
   pnpm prisma:migrate
   ```

5. **Start development servers:**
   ```bash
   pnpm dev
   ```

### Service URLs

| Service | URL | Description |
| :--- | :--- | :--- |
| **Frontend Application** | `http://localhost:3010` | Next.js 15 App Router & BFF |
| **Backend API** | `http://localhost:3000` | NestJS Monolith API |
| **API Documentation** | `http://localhost:3000/docs` | Swagger UI (Development only) |
| **Health Check** | `http://localhost:3000/health` | Service & DB Health Probe |

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Starts frontend (`:3010`) and backend (`:3000`) in watch mode |
| `pnpm build` | Compiles all packages and validates production bundles with 0 type errors |
| `pnpm test` | Runs all backend (Jest) and frontend (Vitest) unit test suites |
| `pnpm lint` | Executes ESLint across the codebase |
| `pnpm prisma:generate` | Generates the typed Prisma 7 client |
| `pnpm prisma:migrate` | Runs database migrations against PostgreSQL |
| `pnpm seed` | Resets and populates development seed data |
| `pnpm docker:up` / `pnpm docker:down` | Manages PostgreSQL 17 and Redis container lifecycles |

---

## Security & Environment Variables

Security is built into every layer of VeriBuy. Follow these mandatory practices:

### 1. Secret Isolation & Zero Leakage
- **Server-Side Secrets:** Keys like `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `JWT_SECRET`, `ROYAL_MAIL_CLIENT_SECRET`, and `CLOUDINARY_API_SECRET` must **never** be prefixed with `NEXT_PUBLIC_` or imported into client components.
- **Client Variables:** Only public identifiers (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) are permitted in the client-side bundle.
- **Version Control:** Never commit `.env`, `.env.local`, or generated credentials.

### 2. Authentication & Authorization
- **HttpOnly Cookies:** Authentication tokens are stored strictly in `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookies. Tokens are never stored in browser `localStorage`.
- **Server-Side Role & Ownership Enforcement:** Every state transition (e.g. escrow release, order status, shipping confirmation, KYC validation) is authorized on the backend.
- **Timing-Safe Validation:** Internal service-to-service calls and webhook signatures use `crypto.timingSafeEqual` to prevent timing attacks.

### 3. Payment & Escrow Integrity
- **Server-Owned Calculations:** Item pricing, shipping rates, buyer protection fees, and escrow payouts are calculated exclusively by backend domain logic.
- **Idempotent Webhooks:** Stripe webhook handlers verify signatures and ensure idempotent processing for payment fulfillment.

---

## Deployment (Render Blueprint)

The repository includes a production-ready Blueprint (`render.yaml`) provisioning:
- `veribuy-backend`: NestJS Web Service (Frankfurt)
- `veribuy-frontend`: Next.js Web Service (Frankfurt)
- `veribuy-postgres`: PostgreSQL 17 Database
- `veribuy-redis`: Key-Value Redis Instance

### Production Checklist
1. Link repository to Render as a **Blueprint**.
2. Supply secrets via the Render Secret Manager (`STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `CLOUDINARY_*`, `IMEI_CHECK_*`, `ROYAL_MAIL_*`).
3. Migrations execute automatically on deploy via `prisma migrate deploy`.
4. Ensure Swagger API docs remain disabled when `NODE_ENV=production`.
