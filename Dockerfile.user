# Multi-stage build for user-service in pnpm monorepo
# Build context: repo root
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate
WORKDIR /app

# Dependencies stage - install all workspace dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/user-service/package.json ./services/user-service/
RUN pnpm install --frozen-lockfile --filter @veribuy/user-service...

# Build stage
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY packages ./packages
COPY services/user-service ./services/user-service
# Build shared packages first
RUN pnpm --filter @veribuy/common build || true
RUN pnpm --filter @veribuy/redis-cache build || true
WORKDIR /app/services/user-service
RUN cp prisma/prisma.config.ts prisma.config.ts
RUN pnpm exec prisma generate
RUN pnpm build

# Production stage
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/user-service/package.json ./services/user-service/
RUN pnpm install --prod --frozen-lockfile --filter @veribuy/user-service...
COPY --from=build /app/services/user-service/dist ./services/user-service/dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY services/user-service/prisma ./services/user-service/prisma
WORKDIR /app/services/user-service
EXPOSE 3002
CMD ["node", "dist/main"]
