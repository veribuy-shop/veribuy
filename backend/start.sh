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

# Disable Redis if connection fails (temporary workaround for Render free tier)
if [ -n "$REDIS_URL" ]; then
  echo "Testing Redis connection..."
  if ! timeout 5 node -e "const Redis = require('ioredis'); const r = new Redis(process.env.REDIS_URL, {tls: {}, retryStrategy: () => null}); r.on('error', () => process.exit(1)); r.on('connect', () => { r.quit(); process.exit(0); })" 2>/dev/null; then
    echo "Redis unavailable, disabling cache..."
    export REDIS_DISABLED=true
  fi
fi

echo "Running database migrations..."
cd /app/backend
node scripts/run-migrations.js 2>&1 || {
  echo "Migration failed, but continuing startup..."
}

echo "Starting backend..."
exec node /app/backend/dist/src/main.js
