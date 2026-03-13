import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const ADMIN_ROLES = new Set([
  "admin",
  "org_admin",
  "reviewer",
  "finance",
  "auditor",
]);

const LEGACY_WIDGET_ROUTES = new Set([
  "/widget/quote",
  "/widget/instant-quote",
  "/embed/quote",
  "/embed/instant-quote",
]);

const LEGACY_HELP_ROUTES = new Set(["/support", "/help-center"]);

function handleWidgetCORS(
  request: NextRequest,
  response: NextResponse,
): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return response;

  const allowlist = (process.env.WIDGET_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowlist.length > 0 && !allowlist.includes(origin)) {
    return new NextResponse(null, { status: 403 });
  }

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Content-Security-Policy", `frame-ancestors ${origin};`);
  return response;
}

function handleLegacyRedirects(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  if (LEGACY_WIDGET_ROUTES.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/instant-quote";
    request.nextUrl.searchParams.forEach((value, key) =>
      url.searchParams.set(key, value),
    );
    url.searchParams.set("embed", "true");
    return NextResponse.redirect(url);
  }

  if (LEGACY_HELP_ROUTES.has(pathname) || pathname.startsWith("/faq")) {
    const url = request.nextUrl.clone();
    url.pathname = "/help";
    return NextResponse.redirect(url);
  }

  return null;
}

function handleRBAC(
  request: NextRequest,
  authed: boolean,
  role: string,
): NextResponse | null {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && (!authed || !ADMIN_ROLES.has(role))) {
    const url = request.nextUrl.clone();
    url.pathname = "/403";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/portal") && !authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return null;
}

function setSecurityHeaders(response: NextResponse, pathname: string): void {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  const isPaymentRoute =
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/orders/confirmation");

  response.headers.set(
    "Content-Security-Policy",
    isPaymentRoute
      ? "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' https://www.paypal.com https://www.sandbox.paypal.com https://www.paypalobjects.com; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "img-src 'self' data: https:; " +
          "connect-src 'self' https://api.paypal.com https://api-m.paypal.com https://api.sandbox.paypal.com https://api-m.paypal.com; " +
          "frame-src https://www.paypal.com https://www.sandbox.paypal.com; " +
          "object-src 'none'; base-uri 'self'; form-action 'self';"
      : "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googletagmanager.com https://*.google-analytics.com https://*.googleadservices.com https://*.doubleclick.net https://*.facebook.net https://*.apollo.io https://*.clarity.ms https://*.hubspot.com https://*.hsforms.net https://*.hs-analytics.net https://*.hs-banner.com https://*.hscollectedforms.net https://*.hsadspixel.net https://*.lfeeder.com https://*.cloudflareinsights.com; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "img-src 'self' data: https:; " +
          "connect-src 'self' https: wss: https://*.googletagmanager.com https://*.google-analytics.com https://*.facebook.net https://*.apollo.io https://*.aplo-evnt.com; " +
          "frame-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self';",
  );

  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes - they handle their own authentication
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const response = NextResponse.next({ request });

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const authed = !!token;
  const role = (token?.role as string) || "anon";

  // Widget CORS handling
  if (pathname.startsWith("/widget")) {
    return handleWidgetCORS(request, response);
  }

  // Legacy redirects
  const legacyRedirect = handleLegacyRedirects(request);
  if (legacyRedirect) return legacyRedirect;

  // RBAC enforcement
  const rbacRedirect = handleRBAC(request, authed, role);
  if (rbacRedirect) return rbacRedirect;

  // Skip static assets
  if (pathname.startsWith("/_next/")) return response;

  // Security headers
  setSecurityHeaders(response, pathname);

  return response;
}

export const config = {
  matcher: [],
};
