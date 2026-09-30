import type { Relation } from "./contract/enums.ts";
import { ApiException } from "./http.ts";

export type SessionClaims = {
  student_id: string;
  relation: Relation;
  iat: number;
  exp: number;
};

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const pad = (4 - (value.length % 4)) % 4;
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat(pad);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function hmacKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

export async function signSession(
  claims: { student_id: string; relation: Relation },
  secret: string,
  ttlSeconds = 60 * 60 * 2,
): Promise<{ token: string; exp: number }> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionClaims = { ...claims, iat: now, exp: now + ttlSeconds };
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const data = `${header}.${body}`;
  const key = await hmacKey(secret, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
  return { token: `${data}.${bytesToBase64Url(signature)}`, exp: payload.exp };
}

export async function verifySession(token: string, secret: string): Promise<SessionClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new ApiException("UNAUTHORIZED", "로그인이 필요합니다", 401);
  const [header, body, signature] = parts;
  const key = await hmacKey(secret, ["verify"]);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(signature),
    encoder.encode(`${header}.${body}`),
  );
  if (!valid) throw new ApiException("UNAUTHORIZED", "로그인이 필요합니다", 401);
  let payload: SessionClaims;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as SessionClaims;
  } catch {
    throw new ApiException("UNAUTHORIZED", "로그인이 필요합니다", 401);
  }
  if (!payload.student_id || (payload.relation !== "father" && payload.relation !== "mother")) {
    throw new ApiException("UNAUTHORIZED", "로그인이 필요합니다", 401);
  }
  if (payload.exp * 1000 <= Date.now()) {
    throw new ApiException("SESSION_EXPIRED", "로그인 시간이 지났습니다. 다시 로그인해 주세요.", 401);
  }
  return payload;
}

export async function requireSession(req: Request): Promise<SessionClaims> {
  const token = req.headers.get("x-session-token");
  const secret = Deno.env.get("SESSION_SECRET");
  if (!token || !secret) throw new ApiException("UNAUTHORIZED", "로그인이 필요합니다", 401);
  return verifySession(token, secret);
}
