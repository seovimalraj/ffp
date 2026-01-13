# NextAuth Route Conflict Fix

## 🔴 Root Cause

The error `GET /api/auth/error 404` occurs because:

1. **Next Auth catch-all route** at `/api/auth/[...nextauth]/route.ts` should handle ALL `/api/auth/*` requests
2. **Custom route handlers** exist at:
   - `/api/auth/login/route.ts`
   - `/api/auth/register/route.ts`
   - `/api/auth/signin/route.ts`
   - `/api/auth/me/route.ts`
   - `/api/auth/logout/route.ts`
   - `/api/auth/session-leg/route.ts`

3. In Next.js App Router, **specific routes take precedence over catch-all routes**
4. When NextAuth tries to call `/api/auth/error`, it hits a 404 because there's no specific handler for it, and the catch-all `[...nextauth]` is not being invoked

## ✅ Solution

**Delete the conflicting custom auth routes** to let NextAuth's catch-all handler work properly.

### Files to Delete

```bash
rm apps/web/app/api/auth/login/route.ts
rm apps/web/app/api/auth/register/route.ts  
rm apps/web/app/api/auth/signin/route.ts
rm apps/web/app/api/auth/logout/route.ts
rm apps/web/app/api/auth/me/route.ts
rm apps/web/app/api/auth/session-leg/route.ts
```

### Why It's Safe to Delete

1. Your app already uses NextAuth's `signIn()` function in all modern components:
   - `SignInForm.tsx` → Uses `signIn("credentials", ...)`
   - `SignUpForm.tsx` → Uses `signIn("credentials", ...)`  
   - `instant-quote/page.tsx` → Uses `signIn("credentials", ...)`

2. The custom routes were legacy endpoints that duplicated NextAuth's functionality

3. NextAuth provides all these endpoints automatically:
   - `/api/auth/signin` - Handled by NextAuth
   - `/api/auth/signout` - Handled by NextAuth
   - `/api/auth/session` - Handled by NextAuth
   - `/api/auth/error` - Handled by NextAuth ✅ THIS IS THE ONE FAILING

### Optional: Keep Legacy Support

If you need to keep legacy `AuthContext` support temporarily, the endpoints have been moved to:
- `/api/v1/auth/login` 
- `/api/v1/auth/register`

Update `AuthContext.tsx` to use these new paths.

## 🚀 Implementation Steps

### Step 1: Delete Conflicting Routes

```bash
cd /root/FFP
rm -rf apps/web/app/api/auth/login
rm -rf apps/web/app/api/auth/register
rm -rf apps/web/app/api/auth/signin
rm -rf apps/web/app/api/auth/logout
rm -rf apps/web/app/api/auth/me
rm -rf apps/web/app/api/auth/session-leg
```

### Step 2: Keep Only NextAuth Files

After deletion, `/apps/web/app/api/auth/` should only contain:
```
app/api/auth/
├── [...nextauth]/
│   └── route.ts          ← KEEP (NextAuth handler)
└── test/
    └── route.ts          ← KEEP (Test endpoint)
```

### Step 3: Rebuild & Restart

```bash
docker compose down
docker compose build web
docker compose up -d
```

### Step 4: Verify

```bash
# Test NextAuth endpoints
curl https://app.frigate.ai/api/auth/csrf
curl https://app.frigate.ai/api/auth/providers
curl https://app.frigate.ai/api/auth/session

# Should now work (was returning 404)
curl https://app.frigate.ai/api/auth/error
```

## 📊 Route Ownership After Fix

| Route Pattern | Handler | Purpose |
|--------------|---------|---------|
| `/api/auth/*` | NextAuth catch-all | Session management, OAuth, etc. |
| `/api/v1/auth/*` | Custom handlers | Legacy endpoints (if needed) |
| `/api/*` (other) | NestJS backend | Business logic APIs |
| `/auth/*` | Next.js pages | Custom auth UI (error, signin) |

## 🧪 Testing After Fix

1. **Sign In Flow**
   ```
   https://app.frigate.ai/signin
   → Enter credentials
   → Should successfully sign in
   → No 404 errors in console
   ```

2. **Error Handling**
   ```
   https://app.frigate.ai/auth/error?error=Configuration
   → Should show custom error page
   → No 404 errors
   ```

3. **NextAuth Endpoints**
   ```bash
   curl https://app.frigate.ai/api/auth/csrf        # Should return CSRF token
   curl https://app.frigate.ai/api/auth/providers   # Should return provider list
   curl https://app.frigate.ai/api/auth/error       # Should return error page (was 404)
   ```

## 📝 Notes

- **AuthContext** (`apps/web/src/contexts/AuthContext.tsx`) is legacy and barely used
- Most components use `useSession()` from NextAuth or `signIn()` from NextAuth
- The custom `/api/auth/signin/route.ts` had complex fallback logic for demo users - this should be moved to NextAuth's `authorize()` callback if needed
- Keep `/api/auth/test/route.ts` for configuration testing

## ⚠️ If You Need Custom Auth Logic

Move custom authentication logic to NextAuth's `authorize()` callback in `lib/auth/index.ts`:

```typescript
CredentialsProvider({
  async authorize(credentials) {
    // Add your custom auth logic here
    // This replaces /api/auth/signin custom endpoint
  }
})
```
