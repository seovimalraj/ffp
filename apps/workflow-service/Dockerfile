# =========================
# 1. Prune stage
# =========================
FROM node:20-alpine AS pruner
WORKDIR /app

# Use repo-local turbo if available
RUN corepack enable
RUN pnpm add -g turbo

COPY . .

# Prune monorepo to workflow-service only
RUN turbo prune --scope=workflow-service --docker

# =========================
# 2. Install stage
# =========================
FROM node:20-alpine AS installer
WORKDIR /app

RUN corepack enable

# Copy pruned package manifests + lockfile
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install prod deps only (important)
RUN pnpm install --frozen-lockfile --prod

# =========================
# 3. Build stage
# =========================
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable

# Bring installed deps + full pruned source
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .

# Build only workflow-service
RUN pnpm turbo run build --filter=workflow-service

# =========================
# 4. Runtime stage
# =========================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3004

# Optional: health/debug tools
RUN apk add --no-cache curl

# Non-root user
RUN addgroup -S inngest -g 1001 && \
    adduser -S inngest -u 1001 -G inngest

# Copy ONLY what is required at runtime
COPY --from=builder --chown=inngest:inngest /app/apps/workflow-service/dist ./dist
COPY --from=builder --chown=inngest:inngest /app/apps/workflow-service/package.json ./package.json
COPY --from=builder --chown=inngest:inngest /app/apps/workflow-service/node_modules ./node_modules

USER inngest
EXPOSE 3004

CMD ["node", "dist/index.js"]
