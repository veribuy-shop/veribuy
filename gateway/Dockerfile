# Multi-stage build for API Gateway (monorepo)
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate
WORKDIR /app

# Dependencies stage - install all monorepo dependencies
FROM base AS deps
# Copy workspace configuration from parent directory
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy all packages and gateway (needed for workspace resolution)
COPY packages ./packages
COPY gateway ./gateway
# Install all dependencies for the workspace
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS build
# Copy installed node_modules
COPY --from=deps /app .
# Copy source code
COPY packages ./packages
COPY gateway ./gateway
# Build shared packages first
WORKDIR /app
RUN pnpm --filter @veribuy/logger run build
# Build the gateway
WORKDIR /app/gateway
RUN pnpm build

# Development stage (use --target=development to select)
FROM base AS development
COPY --from=deps /app .
COPY packages ./packages
COPY gateway ./gateway
WORKDIR /app/gateway
EXPOSE 3000
CMD ["pnpm", "run", "dev"]

# Production stage (default — last stage)
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy all packages and gateway package.json files for workspace resolution
COPY packages ./packages
COPY gateway ./gateway
# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile
# Copy compiled packages and built application from build stage
COPY --from=build /app/packages/logger/dist ./packages/logger/dist
COPY --from=build /app/gateway/dist ./gateway/dist
# Set working directory to the gateway
WORKDIR /app/gateway
EXPOSE 3000
CMD ["node", "dist/main"]
