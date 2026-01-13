#!/bin/bash
# Fix NextAuth route conflicts by removing custom auth endpoints

set -e

echo "🔧 NextAuth Route Conflict Fix"
echo "================================"
echo ""

AUTH_DIR="apps/web/app/api/auth"

# Directories to remove (conflicting with NextAuth)
DIRS_TO_REMOVE=(
    "$AUTH_DIR/login"
    "$AUTH_DIR/register"
    "$AUTH_DIR/signin"
    "$AUTH_DIR/logout"
    "$AUTH_DIR/me"
    "$AUTH_DIR/session-leg"
)

echo "📋 The following directories will be deleted:"
for dir in "${DIRS_TO_REMOVE[@]}"; do
    if [ -d "$dir" ]; then
        echo "  ❌ $dir"
    else
        echo "  ⚠️  $dir (not found)"
    fi
done

echo ""
echo "📁 These will be kept:"
echo "  ✅ $AUTH_DIR/[...nextauth]/ (NextAuth handler)"
echo "  ✅ $AUTH_DIR/test/ (Test endpoint)"

echo ""
read -p "Continue with deletion? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "🗑️  Removing conflicting routes..."

REMOVED=0
for dir in "${DIRS_TO_REMOVE[@]}"; do
    if [ -d "$dir" ]; then
        rm -rf "$dir"
        echo "  ✅ Removed: $dir"
        ((REMOVED++))
    fi
done

echo ""
if [ $REMOVED -gt 0 ]; then
    echo "✅ Successfully removed $REMOVED conflicting routes"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Rebuild web container: docker compose build web"
    echo "  2. Restart services: docker compose restart web nginx"
    echo "  3. Test: https://app.frigate.ai/api/auth/error"
else
    echo "ℹ️  No files were removed (already clean)"
fi

echo ""
