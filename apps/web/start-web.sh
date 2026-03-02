#!/bin/sh

# Start the Next.js standalone application
echo "Starting Next.js application..."

# Cap V8 heap at 75% of container memory limit (512M) to prevent OOM kills
export NODE_OPTIONS="--max-old-space-size=384"
node apps/web/server.js