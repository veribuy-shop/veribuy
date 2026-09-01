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
  TEST_OUTPUT=$(timeout 5 node -e "
    const Redis = require('ioredis');
    const tlsOn = process.env.REDIS_TLS === 'true';
    const url = process.env.REDIS_URL;
    const effective = tlsOn && url.startsWith('redis://') ? url.replace(/^redis:\/\//, 'rediss://') : url;
    let masked = effective;
    try { masked = masked.replace(/\/\/[^@]+@/, '//***@'); } catch {}
    const r = new Redis(effective, { tls: tlsOn ? {} : undefined, retryStrategy: () => null });
    r.on('error', (e) => { console.error('TEST FAILED: ' + masked.split('@').pop() + ' -> ' + e.message); process.exit(1); });
    r.on('connect', () => { console.error('TEST OK: ' + masked); r.quit(); process.exit(0); });
  " 2>&1)
  TEST_CODE=$?
  if [ "$TEST_CODE" -ne 0 ]; then
    echo "WARNING: Redis connection test failed —$(printf " %s" "$TEST_OUTPUT")"
    echo "         IMEI checks and caches may be unavailable. Check REDIS_URL / REDIS_TLS on this service."
  else
    echo "Redis connection OK: $(printf " %s" "$TEST_OUTPUT")"
  fi
else
  echo "NOTE: REDIS_URL is not set on this service — Redis will fall back to localhost."
fi

echo "Running database migrations..."
cd /app/backend
node scripts/run-migrations.js 2>&1 || {
  echo "Migration failed, but continuing startup..."
}

echo "Starting backend..."
exec node /app/backend/dist/src/main.js
