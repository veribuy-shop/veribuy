# Multi-stage build for trust-lens-service in pnpm monorepo
# Build context: repo root
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate
WORKDIR /app

# Dependencies stage - install all workspace dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/trust-lens-service/package.json ./services/trust-lens-service/
RUN pnpm install --frozen-lockfile --filter @veribuy/trust-lens-service...

# Build stage - copy full installed workspace from deps, then overlay source
FROM base AS build
COPY --from=deps /app ./
COPY services/trust-lens-service ./services/trust-lens-service
RUN pnpm --filter @veribuy/common run build || true
RUN pnpm --filter @veribuy/redis-cache run build || true
RUN cd services/trust-lens-service && cp prisma/prisma.config.ts prisma.config.ts && node_modules/.bin/prisma generate
RUN pnpm --filter @veribuy/trust-lens-service run build

# Production stage
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/trust-lens-service/package.json ./services/trust-lens-service/
RUN pnpm install --prod --frozen-lockfile --filter @veribuy/trust-lens-service...
COPY --from=build /app/services/trust-lens-service/dist ./services/trust-lens-service/dist
COPY --from=build /app/services/trust-lens-service/node_modules/.prisma ./services/trust-lens-service/node_modules/.prisma
COPY --from=build /app/services/trust-lens-service/node_modules/@prisma ./services/trust-lens-service/node_modules/@prisma
COPY services/trust-lens-service/prisma ./services/trust-lens-service/prisma
WORKDIR /app/services/trust-lens-service
EXPOSE 3004
CMD ["node", "dist/main"]
