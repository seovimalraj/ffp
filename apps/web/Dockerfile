# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN npm install -g pnpm@10.16.1
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/web ./apps/web
COPY packages ./packages

# Verify OCCT runtime artifacts as a matched pair before building
RUN node apps/web/scripts/verify-occt-export.mjs
RUN node apps/web/scripts/verify-occt-export-runtime.mjs

# Build
RUN pnpm --filter web build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy built standalone application from builder
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Copy startup script
COPY apps/web/start-web.sh ./start-web.sh
RUN chmod +x ./start-web.sh

# Expose port
EXPOSE 3000

# Run with startup script
CMD ["./start-web.sh"]
