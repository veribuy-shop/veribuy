# Railway Environment Variables Reference

Each NestJS microservice is deployed as a separate Railway service.
Set these variables in the Railway dashboard under each service's **Variables** tab.

---

## How DATABASE_URL works on Railway

Railway auto-injects `DATABASE_URL` when you link the Postgres plugin to a service.
The injected URL already includes `?sslmode=require` (required for `postgres-ssl`).

**Each service needs its own schema suffix.** Override `DATABASE_URL` in each service with:
```
postgresql://postgres:<password>@<host>.railway.app:5432/railway?schema=<name>&sslmode=require
```

Copy the base URL from the Postgres plugin's **Connect** tab, then append the correct schema for each service.

---

## Variables common to ALL 7 backend services

| Variable | Value / Notes |
|---|---|
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://dev.veribuy.shop` |

---

## auth-service  (port 3001)

| Variable | Value / Notes |
|---|---|
| `PORT` | `3001` |
| `DATABASE_URL` | `<base-postgres-url>?schema=auth&sslmode=require` |
| `JWT_SECRET` | strong random string (≥32 chars) |
| `JWT_REFRESH_SECRET` | different strong random string (≥32 chars) |
| `JWT_EXPIRATION` | `15m` |
| `JWT_REFRESH_EXPIRATION` | `7d` |

---

## user-service  (port 3002)

| Variable | Value / Notes |
|---|---|
| `PORT` | `3002` |
| `DATABASE_URL` | `<base-postgres-url>?schema=users&sslmode=require` |
| `REDIS_URL` | Railway Redis URL — auto-injected when you link the Redis plugin |

---

## listing-service  (port 3003)

| Variable | Value / Notes |
|---|---|
| `PORT` | `3003` |
| `DATABASE_URL` | `<base-postgres-url>?schema=listings&sslmode=require` |
| `REDIS_URL` | Railway Redis URL |

---

## trust-lens-service  (port 3004)

| Variable | Value / Notes |
|---|---|
| `PORT` | `3004` |
| `DATABASE_URL` | `<base-postgres-url>?schema=trust_lens&sslmode=require` |
| `IMEI_CHECK_API_KEY` | `UX0VY-fYLgn-wMIhe-w2ZJU-B34Qw-OFq9R` |

---

## evidence-service  (port 3006)

| Variable | Value / Notes |
|---|---|
| `PORT` | `3006` |
| `DATABASE_URL` | `<base-postgres-url>?schema=evidence&sslmode=require` |
| `CLOUDINARY_CLOUD_NAME` | `dejkqocnp` |
| `CLOUDINARY_API_KEY` | `854926915891647` |
| `CLOUDINARY_API_SECRET` | `SPOIVKm71nXtrO7YIqa-WCdi-eQ` |

---

## transaction-service  (port 3007)

| Variable | Value / Notes |
|---|---|
| `PORT` | `3007` |
| `DATABASE_URL` | `<base-postgres-url>?schema=transactions&sslmode=require` |
| `STRIPE_SECRET_KEY` | `sk_test_...` — from your Stripe dashboard (test mode) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` — from Stripe dashboard after registering the webhook |
| `NOTIFICATION_SERVICE_URL` | `http://notification-service.railway.internal:3008` |
| `LISTING_SERVICE_URL` | `http://listing-service.railway.internal:3003` |
| `INTERNAL_SERVICE_TOKEN` | any strong shared secret — must match the value set on the web service |

---

## notification-service  (port 3008)

| Variable | Value / Notes |
|---|---|
| `PORT` | `3008` |
| `DATABASE_URL` | `<base-postgres-url>?schema=notifications&sslmode=require` |
| `REDIS_URL` | Railway Redis URL |

---

## Notes

- **SSL:** Railway Postgres is `postgres-ssl:17` — always include `sslmode=require` in every `DATABASE_URL`.
- **REDIS_URL:** Railway Redis auto-injects `REDIS_URL`. The `@veribuy/redis-cache` package now accepts `REDIS_URL` directly (falls back to `REDIS_HOST`/`REDIS_PORT` for local dev).
- **Private networking:** Services in the same Railway project talk to each other via `<service-name>.railway.internal` hostnames at no egress cost. Use these for `*_SERVICE_URL` variables.
- **Postgres schemas:** All 7 services share one Postgres instance, each with its own schema. The schema suffix must be in the `DATABASE_URL`.
- **RabbitMQ:** Provisioned but not used — delete it from Railway to avoid unnecessary cost.
- **Railway Bucket:** Provisioned but not needed — Cloudinary handles all file storage. Leave idle or delete.
- **MinIO / Jaeger / Loki / Grafana:** Not used — do not provision.
