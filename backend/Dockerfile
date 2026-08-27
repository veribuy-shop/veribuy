FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY packages ./packages
COPY backend ./backend
RUN pnpm --filter @veribuy/common build
RUN pnpm --filter @veribuy/logger build
RUN pnpm --filter @veribuy/redis-cache build
RUN pnpm --filter @veribuy/backend prisma:generate
RUN pnpm --filter @veribuy/backend build

FROM base AS production
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/packages ./packages
COPY --from=build --chown=nestjs:nodejs /app/backend ./backend
COPY --chown=nestjs:nodejs backend/start.sh ./start.sh
RUN chmod +x ./start.sh
USER nestjs
EXPOSE 3000
CMD ["./start.sh"]
