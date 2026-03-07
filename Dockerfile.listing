# Multi-stage build for listing-service in pnpm monorepo
# Build context: repo root
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate
WORKDIR /app

# Dependencies stage - install all workspace dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/listing-service/package.json ./services/listing-service/
RUN pnpm install --frozen-lockfile --filter @veribuy/listing-service...

# Build stage
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/listing-service/node_modules ./services/listing-service/node_modules 2>/dev/null || true
COPY packages ./packages
COPY services/listing-service ./services/listing-service
# Build shared packages first
RUN pnpm --filter @veribuy/common build || true
RUN pnpm --filter @veribuy/redis-cache build || true
WORKDIR /app/services/listing-service
RUN npx prisma generate
RUN pnpm build

# Production stage
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/listing-service/package.json ./services/listing-service/
RUN pnpm install --prod --frozen-lockfile --filter @veribuy/listing-service...
COPY --from=build /app/services/listing-service/dist ./services/listing-service/dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY services/listing-service/prisma ./services/listing-service/prisma
WORKDIR /app/services/listing-service
EXPOSE 3003
CMD ["node", "dist/main"]
