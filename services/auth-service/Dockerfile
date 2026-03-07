# Multi-stage build for auth-service in pnpm monorepo
# Build context: repo root (Railway sets Root Directory to services/auth-service,
# but COPY paths below are written for root context via dockerfilePath resolution)
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/auth-service/package.json ./services/auth-service/
RUN pnpm install --frozen-lockfile --filter @veribuy/auth-service...

# Build stage - everything runs from /app (workspace root)
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY packages ./packages
COPY services/auth-service ./services/auth-service
RUN pnpm --filter @veribuy/common run build || true
RUN pnpm --filter @veribuy/redis-cache run build || true
RUN cp services/auth-service/prisma/prisma.config.ts services/auth-service/prisma.config.ts
RUN pnpm --filter @veribuy/auth-service exec prisma generate
RUN pnpm --filter @veribuy/auth-service run build

# Production stage
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/auth-service/package.json ./services/auth-service/
RUN pnpm install --prod --frozen-lockfile --filter @veribuy/auth-service...
COPY --from=build /app/services/auth-service/dist ./services/auth-service/dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY services/auth-service/prisma ./services/auth-service/prisma
WORKDIR /app/services/auth-service
EXPOSE 3001
CMD ["node", "dist/main"]
