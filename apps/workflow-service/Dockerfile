# 1. Prune Stage: Extract only what's needed for this service
FROM node:20-alpine AS pruner
WORKDIR /app
RUN npm install -g turbo
COPY . .
# Generates a pruned version of the monorepo in /app/out
RUN turbo prune --scope=workflow-service --docker

# 2. Installer Stage: Install dependencies
FROM node:20-alpine AS installer
WORKDIR /app
RUN corepack enable

# Copy pruned lockfile and package.json
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# 3. Builder Stage: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=workflow-service

# 4. Runner Stage: Final production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3004

RUN apk add --no-cache curl

# Security: Non-root user
RUN addgroup -S inngest -g 1001 && \
    adduser -S inngest -u 1001
    
# Copy only the compiled output and production node_modules
# Note: Using out/full/ to get the correct workspace structure if shared packages are used
COPY --from=builder --chown=inngest:inngest /app/apps/workflow-service/dist ./dist
COPY --from=builder --chown=inngest:inngest /app/apps/workflow-service/package.json ./package.json
COPY --from=builder --chown=inngest:inngest /app/node_modules ./node_modules

USER inngest
EXPOSE 3004

CMD [ "node", "dist/index.js" ]