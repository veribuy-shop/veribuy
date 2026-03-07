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
COPY web ./web
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS build
COPY --from=deps /app ./
# Copy pnpm from deps stage to avoid re-downloading
COPY --from=deps /root/.local/share/pnpm /root/.local/share/pnpm
WORKDIR /app/web
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

# Copy build artifacts from /app/web subdirectory
# Standalone output includes all necessary files with proper structure
COPY --from=build --chown=nextjs:nodejs /app/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/web/.next/static ./web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/web/public ./web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "web/server.js"]

# Development stage (for local development with hot-reload)
FROM base AS development
COPY --from=deps /app ./
WORKDIR /app/web
EXPOSE 3000
CMD ["pnpm", "dev"]
