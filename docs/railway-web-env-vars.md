# Railway Environment Variables — web (Next.js frontend)

The Next.js frontend (`web/`) is deployed to Railway as a Docker service alongside the backend microservices.
Set these variables in the Railway dashboard under the **web** service's **Variables** tab.

---

## Backend service URLs (server-side only — never exposed to browser)

These are consumed exclusively inside Next.js API Route Handlers (`/web/app/api/**`).
Use the **private Railway internal URLs** (format: `http://<service-name>.railway.internal`) for zero-egress
inter-service communication, or the public Railway HTTPS URLs if private networking is not available on your plan.

> **Important:** Railway private networking uses plain **HTTP** — not HTTPS.
> `.railway.internal` hostnames are only reachable from inside the same Railway project.

| Variable | Example value |
|---|---|
| `AUTH_SERVICE_URL` | `http://auth-service.railway.internal:3001` |
| `USER_SERVICE_URL` | `http://user-service.railway.internal:3002` |
| `LISTING_SERVICE_URL` | `http://listing-service.railway.internal:3003` |
| `TRUST_LENS_SERVICE_URL` | `http://trust-lens-service.railway.internal:3004` |
| `EVIDENCE_SERVICE_URL` | `http://evidence-service.railway.internal:3006` |
| `TRANSACTION_SERVICE_URL` | `http://transaction-service.railway.internal:3007` |
| `NOTIFICATION_SERVICE_URL` | `http://notification-service.railway.internal:3008` |

> Do **not** use the `NEXT_PUBLIC_` prefix for any of these — they must remain server-side only.

---

## Stripe (server-side)

| Variable | Value / Notes |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` (or `sk_test_...` for staging) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` — from Stripe dashboard → Webhooks |

---

## Internal service token

| Variable | Value / Notes |
|---|---|
| `INTERNAL_SERVICE_TOKEN` | Shared secret used for Next.js → transaction-service calls. Must match the value set on the transaction-service Railway service. |

---

## Public variables (accessible in the browser)

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` (or `pk_test_...` for staging) |
| `NEXT_PUBLIC_APP_URL` | `https://dev.veribuy.shop` |

---

## Node / runtime

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `HOSTNAME` | `0.0.0.0` |

---

## Notes

- **Custom domain** — In the Railway dashboard, go to the **web** service → **Settings → Domains**, add `dev.veribuy.shop`, then point a CNAME record at the Railway-provided hostname (e.g. `web-production-xxxx.up.railway.app`).
- **`output: standalone`** — `next.config.ts` already has this set; required for the Docker build. Railway uses `web/Dockerfile` which expects the standalone output.
- **Cloudinary images** — `next.config.ts` already includes `res.cloudinary.com` in `images.remotePatterns`.
- **Stripe webhook endpoint** — register `https://dev.veribuy.shop/api/webhooks/stripe` in the Stripe dashboard and copy the generated `whsec_...` secret into `STRIPE_WEBHOOK_SECRET`.
- **Private networking** — Railway services in the same project communicate via `.railway.internal` hostnames at no egress cost. If your Railway plan does not support private networking, use the public `*.up.railway.app` URLs instead.
