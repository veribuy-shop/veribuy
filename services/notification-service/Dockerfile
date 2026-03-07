# Multi-stage build for notification-service in pnpm monorepo
# Build context: repo root
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate
WORKDIR /app

# Dependencies stage - install all workspace dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/notification-service/package.json ./services/notification-service/
RUN pnpm install --frozen-lockfile --filter @veribuy/notification-service...

# Build stage
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY packages ./packages
COPY services/notification-service ./services/notification-service
# Build shared packages first
RUN pnpm --filter @veribuy/common build || true
RUN pnpm --filter @veribuy/redis-cache build || true
WORKDIR /app/services/notification-service
RUN cp prisma/prisma.config.ts prisma.config.ts
RUN pnpm exec prisma generate
RUN pnpm build

# Production stage
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/notification-service/package.json ./services/notification-service/
RUN pnpm install --prod --frozen-lockfile --filter @veribuy/notification-service...
COPY --from=build /app/services/notification-service/dist ./services/notification-service/dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY services/notification-service/prisma ./services/notification-service/prisma
WORKDIR /app/services/notification-service
EXPOSE 3008
CMD ["node", "dist/main"]
