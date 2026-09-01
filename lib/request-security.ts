import { NextRequest, NextResponse } from "next/server";

export const REP_ARC_REQUEST_HEADER = "x-reparc-request";

type HeaderValues = Record<string, string>;
export class RequestSecurityError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly headers: HeaderValues = {},
  ) {
    super(message);
    this.name = "RequestSecurityError";
  }
}

const validOrigin = (value: string | undefined) => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export function requireSameOrigin(request: NextRequest) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    throw new RequestSecurityError(403, "Cross-site requests are not allowed.");
  }

  const configuredOrigins = [process.env.URL, process.env.DEPLOY_PRIME_URL]
    .map(validOrigin)
    .filter((origin): origin is string => Boolean(origin));
  // Production trusts deployment configuration rather than a caller-controlled
  // Host header. Local development falls back to the actual request origin.
  const allowed = new Set<string>(configuredOrigins.length ? configuredOrigins : [request.nextUrl.origin]);

  const sourceOrigin = request.headers.get("origin");
  if (sourceOrigin) {
    const normalized = validOrigin(sourceOrigin);
    if (!normalized || !allowed.has(normalized)) {
      throw new RequestSecurityError(403, "Cross-site requests are not allowed.");
    }
    return;
  }

  // Browser clients send Origin for these mutations. The custom header is a
  // fallback for privacy tools that strip Origin; a cross-site browser cannot
  // add it without a successful CORS preflight, which RepArc never grants.
  if (request.headers.get(REP_ARC_REQUEST_HEADER) !== "1") {
    throw new RequestSecurityError(403, "Request origin could not be verified.");
  }
}

export async function readJsonBody(request: NextRequest, maximumBytes: number) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new RequestSecurityError(415, "This endpoint accepts JSON only.");
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new RequestSecurityError(413, "The request is too large.");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new RequestSecurityError(413, "The request is too large.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RequestSecurityError(400, "The request body is not valid JSON.");
  }
}

export function securityErrorResponse(error: unknown) {
  if (!(error instanceof RequestSecurityError)) return null;
  return NextResponse.json(
    { error: error.message },
    {
      status: error.status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Vary": "Origin, Sec-Fetch-Site",
        ...error.headers,
      },
    },
  );
}

export function databaseRateLimitResponse(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  const combined = [record.message, record.details, record.hint].filter((value) => typeof value === "string").join(" ");
  if (!combined.includes("rate_limit_exceeded")) return null;
  const retryAfter = Math.max(1, Math.min(3600, Number(combined.match(/retry_after_seconds=(\d+)/)?.[1]) || 60));
  return NextResponse.json(
    { error: "Too many requests. Please wait and try again." },
    {
      status: 429,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Retry-After": String(retryAfter),
      },
    },
  );
}
