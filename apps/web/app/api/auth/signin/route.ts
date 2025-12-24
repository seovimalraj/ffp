import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
// Dynamic import to ensure pg is included in Next.js standalone build
let pool: any = null;

async function getPool() {
  if (pool) return pool;

  const pg = await import("pg");
  const { Pool } = pg.default || pg;

  pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@supabase:5432/postgres",
  });

  return pool;
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    // Try primary path: authenticate via Postgres RPC
    let authUser: any = null;
    let publicUser: any = {};
    try {
      const dbPool = await getPool();

      // Call our custom authenticate_user function via direct PostgreSQL
      const result = await dbPool.query(
        "SELECT * FROM authenticate_user($1, $2)",
        [email, password],
      );

      const authData = result.rows[0]?.authenticate_user;

      if (!authData || !authData.valid || !authData.user_id) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 },
        );
      }

      // Fetch user details from auth.users
      const authUserResult = await dbPool.query(
        `SELECT id, email, confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
         FROM auth.users WHERE id = $1`,
        [authData.user_id],
      );

      if (authUserResult.rows.length === 0) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      authUser = authUserResult.rows[0];

      // Fetch user details from public.users
      const publicUserResult = await dbPool.query(
        `SELECT id, email, organization_id, role, status
         FROM users WHERE id = $1`,
        [authData.user_id],
      );

      publicUser = publicUserResult.rows[0] || {};
    } catch (_error) {
      // Fallback path: demo credentials (no Supabase Auth / RPC needed)
      // This enables quick demo logins when the auth RPC/function is not available.
      const DEMO_PASSWORD = "Demo123!";
      const demoUsers: Record<
        string,
        { id: string; role: string; organization_id: string }
      > = {
        "admin@cncquote.com": {
          id: "a0000000-0000-0000-0000-000000000001",
          role: "admin",
          organization_id: "00000000-0000-0000-0000-000000000001",
        },
        "customer@acme.com": {
          id: "a0000000-0000-0000-0000-000000000002",
          role: "admin",
          organization_id: "00000000-0000-0000-0000-000000000002",
        },
        "john@acme.com": {
          id: "a0000000-0000-0000-0000-000000000004",
          role: "member",
          organization_id: "00000000-0000-0000-0000-000000000002",
        },
        "supplier@precision.com": {
          id: "a0000000-0000-0000-0000-000000000003",
          role: "supplier",
          organization_id: "00000000-0000-0000-0000-000000000003",
        },
        "sarah@precision.com": {
          id: "a0000000-0000-0000-0000-000000000005",
          role: "supplier",
          organization_id: "00000000-0000-0000-0000-000000000003",
        },
      };

      const demoUser = demoUsers[email?.toLowerCase?.() || ""];
      if (!demoUser || password !== DEMO_PASSWORD) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 },
        );
      }

      // Synthesize minimal user shape for session
      authUser = {
        id: demoUser.id,
        email,
        confirmed_at: new Date().toISOString(),
        raw_app_meta_data: {},
        raw_user_meta_data: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      publicUser = {
        id: demoUser.id,
        email,
        organization_id: demoUser.organization_id,
        role: demoUser.role,
        status: "active",
      };
    }

    // Generate session token (simplified JWT)
    const sessionToken = generateSessionToken({
      userId: authUser.id,
      email: authUser.email,
      role: publicUser.role || "user",
      organizationId: publicUser.organization_id,
    });

    // Create response with session cookie
    const response = NextResponse.json({
      user: {
        id: authUser.id,
        email: authUser.email,
        confirmed_at: authUser.confirmed_at,
        app_metadata: authUser.raw_app_meta_data || {},
        user_metadata: authUser.raw_user_meta_data || {},
        created_at: authUser.created_at,
        updated_at: authUser.updated_at,
        role: publicUser.role,
        organization_id: publicUser.organization_id,
      },
      session: {
        access_token: sessionToken,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
    });

    // Determine if cookies should be marked secure (HTTPS-only)
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const isHttps =
      forwardedProto === "https" || process.env.SECURE_COOKIES === "true";

    // Set session cookie
    response.cookies.set("sb-access-token", sessionToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      maxAge: 3600, // 1 hour
      path: "/",
    });

    // Also set a lightweight user-data cookie to help server routes derive org and role
    // Not httpOnly so client-side can read if needed; value is small and non-sensitive
    const userData = {
      id: publicUser.id,
      email: publicUser.email,
      organization_id: publicUser.organization_id,
      role: publicUser.role,
    };
    response.cookies.set("user-data", JSON.stringify(userData), {
      httpOnly: false,
      secure: isHttps,
      sameSite: "lax",
      maxAge: 3600,
      path: "/",
    });

    // Set role cookie for middleware RBAC checks
    response.cookies.set("role", publicUser.role || "user", {
      httpOnly: false,
      secure: isHttps,
      sameSite: "lax",
      maxAge: 3600,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Authentication error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Simple JWT-style token generator
 * In production, use proper JWT library with RS256
 */
function generateSessionToken(payload: any): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payloadStr = Buffer.from(
    JSON.stringify({
      ...payload,
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    }),
  ).toString("base64url");

  const secret =
    process.env.JWT_SECRET || "cnc-quote-jwt-secret-key-2024-production-ready";
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payloadStr}`)
    .digest("base64url");

  return `${header}.${payloadStr}.${signature}`;
}
