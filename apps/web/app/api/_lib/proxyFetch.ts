import { headers as nextHeaders } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  SUPPLIER_PORTAL_VERSION,
  SUPPLIER_PORTAL_VERSION_HEADER,
} from "@cnc-quote/shared";

import { getAuthContext } from "@/lib/getAuthContext";

export const ORG_HEADER = "x-org-id" as const;

const TRACE_HEADERS = ["x-request-id", "x-trace-id"] as const;

type RuntimeHeaders = Awaited<ReturnType<typeof nextHeaders>>;
type HeaderSource = HeadersInit | RuntimeHeaders | undefined;

const SUPPLIER_API_PREFIX = "/api/supplier/";
const SUPPLIER_UPSTREAM_PREFIX = "/supplier/";

const cloneHeaders = (source: HeaderSource): Headers => {
  if (!source) {
    return new Headers();
  }

  if (source instanceof Headers) {
    return new Headers(source);
  }

  const candidate = source as {
    forEach?: (cb: (value: string, key: string) => void) => void;
  };
  if (typeof candidate.forEach === "function") {
    const headers = new Headers();
    candidate.forEach((value: string, key: string) => {
      headers.append(key, value);
    });
    return headers;
  }

  return new Headers(source as HeadersInit);
};

const forwardTracingAndCookies = (incoming: Headers, out: Headers) => {
  TRACE_HEADERS.forEach((header) => {
    const value = incoming.get(header);
    if (value && !out.has(header)) {
      out.set(header, value);
    }
  });

  const cookies = incoming.get("cookie");
  if (cookies && !out.has("cookie")) {
    out.set("cookie", cookies);
  }
};

const parseCookie = (cookieHeader: string | null): Record<string, string> => {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce(
    (acc, part) => {
      const [k, ...rest] = part.trim().split("=");
      if (!k) return acc;
      acc[k] = decodeURIComponent(rest.join("="));
      return acc;
    },
    {} as Record<string, string>,
  );
};

const ensureAuthHeaders = async (incoming: Headers, out: Headers) => {
  if (!out.has("authorization")) {
    const incomingAuth = incoming.get("authorization");
    if (incomingAuth) {
      out.set("authorization", incomingAuth);
    }
  }

  let orgId = out.get(ORG_HEADER) ?? incoming.get(ORG_HEADER) ?? "";
  const hasAuth = Boolean(out.get("authorization"));

  if (!hasAuth) {
    const ctx = await getAuthContext();
    const token = ctx.session?.access_token;
    if (token && !out.has("authorization")) {
      out.set("authorization", `Bearer ${token}`);
    }
    if (!orgId && ctx.orgId) {
      orgId = ctx.orgId;
    }
  }

  // If still no Authorization, fall back to custom session cookie set by our /api/auth/signin route
  if (!out.has("authorization")) {
    const cookies = parseCookie(incoming.get("cookie"));
    const sbAccess = cookies["sb-access-token"];
    if (sbAccess) {
      out.set("authorization", `Bearer ${sbAccess}`);
    }
    // Try to extract org id from user-data cookie
    if (!orgId) {
      // Prefer user-data cookie first
      if (cookies["user-data"]) {
        try {
          const user = JSON.parse(cookies["user-data"]);
          if (
            user &&
            typeof user.organization_id === "string" &&
            user.organization_id.length > 0
          ) {
            orgId = user.organization_id;
          }
        } catch {
          // ignore
        }
      }
      // As a fallback, decode JWT payload to derive org id
      if (!orgId && sbAccess) {
        try {
          const [_h, p] = sbAccess.split(".");
          if (p) {
            const json = Buffer.from(
              p.replace(/-/g, "+").replace(/_/g, "/"),
              "base64",
            ).toString("utf8");
            const payload = JSON.parse(json);
            const derived =
              payload.org_id || payload.orgId || payload.organizationId;
            if (typeof derived === "string" && derived.length > 0) {
              orgId = derived;
            }
          }
        } catch {
          // ignore
        }
      }
    }
  }

  if (orgId) {
    out.set(ORG_HEADER, orgId);
  }
};

export async function proxyFetch(
  req: Request | NextRequest,
  url: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headerContainer = (
    req as unknown as { headers?: HeadersInit | RuntimeHeaders }
  )?.headers;
  const incoming = cloneHeaders(headerContainer ?? (await nextHeaders()));
  const out = cloneHeaders(init.headers as HeaderSource);

  const shouldTagSupplierProxy = (() => {
    const requestPath = (() => {
      const candidate = req as NextRequest & { nextUrl?: URL };
      if (candidate?.nextUrl?.pathname) {
        return candidate.nextUrl.pathname;
      }

      try {
        return new URL((req as Request).url).pathname;
      } catch {
        return "";
      }
    })();

    if (requestPath.startsWith(SUPPLIER_API_PREFIX)) {
      return true;
    }

    try {
      const target = typeof url === "string" ? new URL(url) : url;
      if (target.pathname.startsWith(SUPPLIER_UPSTREAM_PREFIX)) {
        return true;
      }
    } catch {
      if (typeof url === "string" && url.startsWith(SUPPLIER_UPSTREAM_PREFIX)) {
        return true;
      }
    }

    return false;
  })();

  if (shouldTagSupplierProxy && !out.has(SUPPLIER_PORTAL_VERSION_HEADER)) {
    out.set(SUPPLIER_PORTAL_VERSION_HEADER, SUPPLIER_PORTAL_VERSION);
  }

  await ensureAuthHeaders(incoming, out);
  forwardTracingAndCookies(incoming, out);

  if (!out.has("accept")) {
    out.set("accept", "application/json");
  }

  const method = (
    init.method ??
    (req as Request | undefined)?.method ??
    "GET"
  ).toUpperCase();
  const isBodyJson = !(init.body instanceof FormData);
  const needsContentType =
    !out.has("content-type") &&
    method !== "GET" &&
    method !== "HEAD" &&
    method !== "OPTIONS" &&
    isBodyJson;

  if (needsContentType) {
    out.set("content-type", "application/json");
  }

  return fetch(url, {
    ...init,
    method,
    headers: out,
  });
}

export async function forwardJsonWithSchema<T>(
  upstream: Response,
  schema: z.ZodSchema<T>,
) {
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    const contentType = upstream.headers.get("content-type") || "text/plain";
    return new Response(text || upstream.statusText, {
      status: upstream.status,
      headers: { "content-type": contentType },
    });
  }

  try {
    const json = await upstream.json();
    const parsed = schema.parse(json);
    return Response.json(parsed);
  } catch (error) {
    let message = "Schema validation failed";

    if (
      error &&
      typeof error === "object" &&
      "issues" in (error as Record<string, unknown>)
    ) {
      try {
        message = JSON.stringify(
          (error as Record<string, unknown>).issues,
        ).slice(0, 2000);
      } catch {
        message = "Schema validation issues";
      }
    } else if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "string") {
      message = error;
    } else if (error !== undefined && error !== null) {
      try {
        message = JSON.stringify(error);
      } catch {
        message = "Unknown schema validation failure";
      }
    }

    return new Response(`Schema validation failed: ${message}`, {
      status: 502,
      headers: { "content-type": "text/plain" },
    });
  }
}
