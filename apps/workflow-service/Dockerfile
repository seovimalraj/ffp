# =========================
# Base image
# =========================
FROM node:20-slim AS base

# Install pnpm (same as API)
RUN npm install -g pnpm

# =========================
# Build stage
# =========================
FROM base AS builder
WORKDIR /app

# Copy workspace files (same pattern as API)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/workflow-service/ ./apps/workflow-service/

# Install all dependencies (workspace-aware)
RUN pnpm install --frozen-lockfile

# Build workflow service
WORKDIR /app/apps/workflow-service
RUN pnpm build

# =========================
# Production stage
# =========================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3004

# Install curl for health checks / debugging
RUN apk add --no-cache curl

# Copy entire workspace to preserve pnpm layout (critical)
COPY --from=builder /app ./

# Run as non-root user (same security model)
RUN addgroup -g 1001 -S inngest && \
    adduser -S workflow -u 1001 && \
    chown -R workflow:inngest /app

USER workflow

WORKDIR /app/apps/workflow-service

EXPOSE 3004

CMD ["node", "dist/index.js"]
