import { NextRequest, NextResponse } from "next/server";

import type {
  AnalysisError,
  MachiningErrorResponse,
} from "@/types/machining-analysis";

/**
 * Proxy to the CAD service's deterministic machining analysis.
 *
 *   POST /api/cad/analyze-machining   -> POST {CAD_SERVICE_URL}/api/v1/cad/analyze-machining
 *   GET  /api/cad/analyze-machining   -> GET  {...}/analyze-machining/capabilities
 *
 * The upload is streamed straight through rather than parsed and rebuilt, so a
 * large STEP file never lands in the Node process's memory. This route adds no
 * interpretation of its own: it forwards the request, forwards the response,
 * and normalizes transport failures into the same error envelope the CAD
 * service uses, so a client only ever has to handle one error shape.
 *
 * The analysis it returns is geometry only - no cost, machine, process or
 * price. Those belong to downstream services.
 */

export const runtime = "nodejs";
// Large assemblies legitimately take tens of seconds inside OpenCASCADE.
export const maxDuration = 120;

const DEFAULT_CAD_SERVICE_URL = "https://ffp-cad.frigate.ai";
const ANALYZE_PATH = "/api/v1/cad/analyze-machining";
const CAPABILITIES_PATH = "/api/v1/cad/analyze-machining/capabilities";
const REQUEST_TIMEOUT_MS = 115_000;
const CAPABILITIES_TIMEOUT_MS = 10_000;

function cadServiceUrl(): string {
  return (process.env.CAD_SERVICE_URL || DEFAULT_CAD_SERVICE_URL).replace(
    /\/+$/,
    "",
  );
}

function errorBody(
  code: string,
  message: string,
  detail?: Record<string, unknown>,
): MachiningErrorResponse {
  const error: AnalysisError = { code, message, detail: detail ?? null };
  return {
    success: false,
    analysis_version: "1.0",
    errors: [error],
    warnings: [],
  };
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  detail?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(errorBody(code, message, detail), { status });
}

/**
 * Map a transport-level failure onto the CAD service's error envelope.
 *
 * A timeout, a DNS failure and a refused connection are all "the analysis did
 * not happen", and the client should not have to tell fetch's error taxonomy
 * apart to render that.
 */
function upstreamFailure(error: unknown, url: string): NextResponse {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : String(error);

  if (name === "TimeoutError" || name === "AbortError") {
    return errorResponse(
      504,
      "CAD_SERVICE_TIMEOUT",
      `The CAD service did not respond within ${Math.round(
        REQUEST_TIMEOUT_MS / 1000,
      )}s. Very large assemblies can exceed this; try a single solid.`,
      { upstream: url },
    );
  }

  return errorResponse(
    502,
    "CAD_SERVICE_UNREACHABLE",
    `Could not reach the CAD service: ${message}`,
    { upstream: url, hint: "Check CAD_SERVICE_URL and that the service is running." },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return errorResponse(
      415,
      "INVALID_CONTENT_TYPE",
      "Send multipart/form-data with a `file` field. Optional fields: " +
        "unit_system, include_face_details, include_feature_details, " +
        "include_debug_geometry.",
      { received: contentType || "(none)" },
    );
  }

  if (!request.body) {
    return errorResponse(400, "EMPTY_REQUEST", "The request had no body.");
  }

  const target = `${cadServiceUrl()}${ANALYZE_PATH}`;

  // Forward headers that describe the body; everything else (cookies, host)
  // is deliberately dropped - the CAD service is an internal geometry service
  // and has no business seeing the caller's session.
  const headers = new Headers({ "content-type": contentType });
  const contentLength = request.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: "POST",
      headers,
      body: request.body,
      // Required by undici to stream a request body rather than buffer it.
      duplex: "half",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    } as RequestInit & { duplex: "half" });
  } catch (error) {
    console.error("[analyze-machining] upstream request failed", error);
    return upstreamFailure(error, target);
  }

  const raw = await upstream.text();

  // The CAD service always answers with JSON, including for its own errors.
  // Anything else means we hit a proxy, a load balancer or an error page, and
  // passing that through as-is would break every client's parsing.
  try {
    const payload = JSON.parse(raw);
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    console.error(
      "[analyze-machining] non-JSON response from CAD service",
      upstream.status,
      raw.slice(0, 500),
    );
    return errorResponse(
      502,
      "CAD_SERVICE_BAD_RESPONSE",
      "The CAD service returned a non-JSON response.",
      { upstream: target, status: upstream.status, body: raw.slice(0, 500) },
    );
  }
}

/**
 * Kernel status and effective thresholds, for a pre-flight check before an
 * upload. Cheap enough to call on page load.
 */
export async function GET(): Promise<NextResponse> {
  const target = `${cadServiceUrl()}${CAPABILITIES_PATH}`;

  try {
    const upstream = await fetch(target, {
      signal: AbortSignal.timeout(CAPABILITIES_TIMEOUT_MS),
      cache: "no-store",
    });
    const raw = await upstream.text();
    try {
      return NextResponse.json(JSON.parse(raw), { status: upstream.status });
    } catch {
      return errorResponse(
        502,
        "CAD_SERVICE_BAD_RESPONSE",
        "The CAD service returned a non-JSON capabilities response.",
        { upstream: target, status: upstream.status },
      );
    }
  } catch (error) {
    console.error("[analyze-machining] capabilities request failed", error);
    return upstreamFailure(error, target);
  }
}
