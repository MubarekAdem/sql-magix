# ==============================================================================
# SQL Magic Studio - Production Dockerfile
# ==============================================================================
FROM node:24-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# Copy monorepo manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/ui/package.json ./packages/ui/
COPY packages/server/package.json ./packages/server/
COPY packages/cli/package.json ./packages/cli/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig.base.json .npmrc ./
COPY packages/core ./packages/core
COPY packages/ui ./packages/ui
COPY packages/server ./packages/server
COPY packages/cli ./packages/cli

# Build all packages
RUN pnpm build

# ==============================================================================
# Production Runtime Stage
# ==============================================================================
FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# Copy built monorepo
COPY --from=builder /app ./

# Default data volume
VOLUME /data
EXPOSE 3000

# Run sql-magic CLI pointing to /data volume
ENTRYPOINT ["node", "packages/cli/dist/cli.js"]
CMD ["/data", "--host", "0.0.0.0", "--port", "3000", "--no-open"]
