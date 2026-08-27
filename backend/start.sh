#!/bin/sh
set -e

echo "Running database migrations..."
cd /app
pnpm --filter @veribuy/backend exec prisma migrate deploy || {
  echo "Migration failed, but continuing startup..."
}

echo "Starting backend..."
exec node backend/dist/src/main.js
