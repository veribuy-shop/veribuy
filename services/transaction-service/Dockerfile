# Multi-stage build for transaction-service in pnpm monorepo
# Build context: repo root
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate
WORKDIR /app

# Dependencies stage - install all workspace dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/transaction-service/package.json ./services/transaction-service/
RUN pnpm install --frozen-lockfile --filter @veribuy/transaction-service...

# Build stage - everything runs from /app (workspace root)
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY packages ./packages
COPY services/transaction-service ./services/transaction-service
RUN pnpm --filter @veribuy/common run build || true
RUN pnpm --filter @veribuy/redis-cache run build || true
RUN cd services/transaction-service && cp prisma/prisma.config.ts prisma.config.ts && node_modules/.bin/prisma generate
RUN pnpm --filter @veribuy/transaction-service run build

# Production stage
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/transaction-service/package.json ./services/transaction-service/
RUN pnpm install --prod --frozen-lockfile --filter @veribuy/transaction-service...
COPY --from=build /app/services/transaction-service/dist ./services/transaction-service/dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY services/transaction-service/prisma ./services/transaction-service/prisma
WORKDIR /app/services/transaction-service
EXPOSE 3007
CMD ["node", "dist/main"]
