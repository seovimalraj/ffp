# API Service Dockerfile
FROM node:20-slim AS base

# Install pnpm
RUN npm install -g pnpm

# Build stage
FROM base AS builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build API
WORKDIR /app/apps/api
RUN pnpm build

# Production stage  
FROM base AS runner

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Copy the entire workspace to preserve pnpm structure
COPY --from=builder /app ./

# Run as non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/sh -m api && \
    chown -R api:nodejs /app

USER api

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/src/main.js"]
