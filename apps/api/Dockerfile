# API Service Dockerfile
FROM node:20-alpine AS base

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
RUN apk add --no-cache curl

# Copy the entire workspace to preserve pnpm structure
COPY --from=builder /app ./

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S api -u 1001 && \
    chown -R api:nodejs /app

USER api

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/src/main.js"]
