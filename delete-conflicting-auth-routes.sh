#!/bin/bash
# Delete conflicting custom auth routes that block NextAuth

echo "🗑️  Deleting conflicting auth routes..."

rm -rf apps/web/app/api/auth/login
rm -rf apps/web/app/api/auth/register
rm -rf apps/web/app/api/auth/signin
rm -rf apps/web/app/api/auth/logout
rm -rf apps/web/app/api/auth/me
rm -rf apps/web/app/api/auth/session-leg

echo "✅ Deleted all conflicting routes"
echo ""
echo "📁 Remaining auth files:"
ls -la apps/web/app/api/auth/

echo ""
echo "📋 Next steps:"
echo "  1. git add ."
echo "  2. git commit -m 'fix: remove conflicting auth routes that block NextAuth'"
echo "  3. git push"
echo "  4. Redeploy in Dokploy"
