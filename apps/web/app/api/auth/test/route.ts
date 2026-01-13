import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

/**
 * Test endpoint to verify NextAuth configuration
 * GET /api/auth/test
 */
export async function GET() {
  const config = {
    hasSecret: !!authOptions.secret,
    secretLength: authOptions.secret?.length || 0,
    hasProviders: authOptions.providers.length > 0,
    providerCount: authOptions.providers.length,
    strategy: authOptions.session?.strategy,
    maxAge: authOptions.session?.maxAge,
    pages: authOptions.pages,
    env: {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "***SET***" : "MISSING",
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  return NextResponse.json({
    status: "ok",
    message: "NextAuth configuration check",
    config,
    timestamp: new Date().toISOString(),
  });
}
