import type { ErrorCode } from "./contract/enums.ts";

export class ApiException extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function allowedOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const list = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.includes(origin) ? origin : null;
}

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers();
  headers.set("access-control-allow-headers", "apikey, content-type, x-session-token, authorization");
  headers.set("access-control-allow-methods", "POST, OPTIONS");
  headers.set("vary", "origin");
  if (origin) headers.set("access-control-allow-origin", origin);
  return headers;
}

export function handleOptions(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigin(req)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin(req)) });
}

export function jsonResponse(req: Request, body: unknown, status = 200): Response {
  const headers = corsHeaders(allowedOrigin(req));
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

export function errorResponse(req: Request, code: ErrorCode, message: string, status: number): Response {
  return jsonResponse(req, { error: { code, message } }, status);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiException("INVALID_INPUT", "JSON 형식이 아닙니다", 400);
  }
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}
