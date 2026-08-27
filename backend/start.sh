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

echo "Running database migrations..."
cd /app
pnpm --filter @veribuy/backend exec prisma migrate deploy || {
  echo "Migration failed, but continuing startup..."
}

echo "Starting backend..."
exec node backend/dist/src/main.js
