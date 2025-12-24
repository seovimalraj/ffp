import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createDbClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Direct database authentication bypass
 * Validates credentials against auth.users table directly
 * Use only when GoTrue auth service is not available
 */
export async function signInWithPassword(email: string, password: string) {
  try {
    // Create admin client to query auth schema
    const adminClient = createDbClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Query auth.users directly with RPC call to validate password
    const { data, error } = await adminClient.rpc("authenticate_user", {
      user_email: email,
      user_password: password,
    });

    if (error) {
      console.error("Auth error:", error);
      return { data: null, error: { message: "Invalid login credentials" } };
    }

    if (!data || !data.user_id) {
      return { data: null, error: { message: "Invalid login credentials" } };
    }

    // Fetch full user data
    const { data: authUser, error: userError } = await adminClient
      .from("auth.users")
      .select("*")
      .eq("id", data.user_id)
      .single();

    if (userError || !authUser) {
      return { data: null, error: { message: "User not found" } };
    }

    // Create session data
    const session = {
      access_token: generateToken(authUser),
      refresh_token: generateToken(authUser, true),
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
      user: {
        id: authUser.id,
        email: authUser.email,
        email_confirmed_at: authUser.confirmed_at,
        app_metadata: authUser.raw_app_meta_data || {},
        user_metadata: authUser.raw_user_meta_data || {},
        aud: "authenticated",
        created_at: authUser.created_at,
        updated_at: authUser.updated_at,
      },
    };

    return { data: { session, user: session.user }, error: null };
  } catch (err) {
    console.error("Signin error:", err);
    return { data: null, error: { message: "Authentication failed" } };
  }
}

/**
 * Simple JWT token generator (for demo purposes)
 * In production, use proper JWT library with RS256
 */
function generateToken(user: any, isRefresh = false): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + (isRefresh ? 604800 : 3600), // 7 days for refresh, 1 hour for access
      iat: Math.floor(Date.now() / 1000),
    }),
  ).toString("base64url");

  const secret =
    process.env.JWT_SECRET || "cnc-quote-jwt-secret-key-2024-production-ready";
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          // Ignore errors from set during render
          console.log(error);
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch (error) {
          // Ignore errors from remove during render
          console.log(error);
        }
      },
    },
  });
}
