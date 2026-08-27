# Multi-stage build for Next.js (monorepo-compatible)
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Dependencies stage - cached unless package files change
FROM base AS deps
# Copy workspace files from root
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY frontend ./frontend
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS build
COPY --from=deps /app ./
# Copy pnpm from deps stage to avoid re-downloading
COPY --from=deps /root/.local/share/pnpm /root/.local/share/pnpm
WORKDIR /app/frontend
ARG BACKEND_URL=http://backend:3000
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
ENV BACKEND_URL=$BACKEND_URL
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Production stage
FROM base AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

WORKDIR /app

# Copy build artifacts from /app/frontend subdirectory
# Standalone output includes all necessary files with proper structure
COPY --from=build --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=nextjs:nodejs /app/frontend/public ./frontend/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "frontend/server.js"]

# Development stage (for local development with hot-reload)
FROM base AS development
COPY --from=deps /app ./
WORKDIR /app/frontend
EXPOSE 3000
CMD ["pnpm", "dev"]
