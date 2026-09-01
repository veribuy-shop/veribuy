#!/bin/sh
set -e

# Add SSL accept for self-signed certs (Render internal Postgres)
if [ -n "$DATABASE_URL" ] && ! echo "$DATABASE_URL" | grep -q "sslaccept="; then
  if echo "$DATABASE_URL" | grep -q "sslmode=require"; then
    export DATABASE_URL="${DATABASE_URL}&sslaccept=accept-invalid-certs"
  else
    export DATABASE_URL="${DATABASE_URL}?sslmode=require&sslaccept=accept-invalid-certs"
  fi
fi

# The IMEI check queue and API caches depend on Redis, so we must NOT silently
# disable it (that stops IMEI verification from ever running). Test the
# connection honoring REDIS_TLS (never hardcode TLS), and on failure only log a
# warning — the app's per-service fail-open paths handle a real outage without
# turning off features. The old auto REDIS_DISABLED=true left listings stuck in
# PENDING because no IMEI check could run.
if [ -n "$REDIS_URL" ]; then
  echo "Testing Redis connection..."
  if ! timeout 5 node -e "const Redis = require('ioredis'); const tlsOn = process.env.REDIS_TLS === 'true'; const r = new Redis(process.env.REDIS_URL, {tls: tlsOn ? {} : undefined, retryStrategy: () => null}); r.on('error', () => process.exit(1)); r.on('connect', () => { r.quit(); process.exit(0); })" 2>/dev/null; then
    echo "WARNING: Redis connection test failed — IMEI checks and caches may be unavailable."
  else
    echo "Redis connection OK."
  fi
fi

echo "Running database migrations..."
cd /app/backend
node scripts/run-migrations.js 2>&1 || {
  echo "Migration failed, but continuing startup..."
}

echo "Starting backend..."
exec node /app/backend/dist/src/main.js
