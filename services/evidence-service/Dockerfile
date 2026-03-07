# Multi-stage build for evidence-service in pnpm monorepo
# Build context: repo root
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate
WORKDIR /app

# Dependencies stage - install all workspace dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/evidence-service/package.json ./services/evidence-service/
RUN pnpm install --frozen-lockfile --filter @veribuy/evidence-service...

# Build stage
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY packages ./packages
COPY services/evidence-service ./services/evidence-service
# Build shared packages first
RUN pnpm --filter @veribuy/common build || true
RUN pnpm --filter @veribuy/redis-cache build || true
WORKDIR /app/services/evidence-service
RUN npx prisma generate
RUN pnpm build

# Production stage
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/evidence-service/package.json ./services/evidence-service/
RUN pnpm install --prod --frozen-lockfile --filter @veribuy/evidence-service...
COPY --from=build /app/services/evidence-service/dist ./services/evidence-service/dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY services/evidence-service/prisma ./services/evidence-service/prisma
WORKDIR /app/services/evidence-service
EXPOSE 3006
CMD ["node", "dist/main"]
