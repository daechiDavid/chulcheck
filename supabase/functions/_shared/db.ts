import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ApiException } from "./http.ts";
import type { output, ZodTypeAny } from "zod";

export type AdminClient = SupabaseClient;

export function adminClient(): AdminClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new ApiException("INVALID_INPUT", "서버 설정이 없습니다", 500);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function parseInput<S extends ZodTypeAny>(schema: S, data: unknown): output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiException("INVALID_INPUT", result.error.issues[0]?.message ?? "입력을 확인해 주세요", 400);
  }
  return result.data;
}

export function assertOwnSignature(path: string, classroomId: string, studentId: string): void {
  const prefix = `${classroomId}/${studentId}/`;
  if (!path.startsWith(prefix) || path.includes("..") || !path.endsWith(".png")) {
    throw new ApiException("INVALID_INPUT", "서명 파일이 올바르지 않습니다", 400);
  }
}

export function requirePepper(): string {
  const pepper = Deno.env.get("PHONE_PEPPER");
  if (!pepper) throw new ApiException("INVALID_INPUT", "서버 설정이 없습니다", 500);
  return pepper;
}

export function requireSessionSecret(): string {
  const secret = Deno.env.get("SESSION_SECRET");
  if (!secret) throw new ApiException("INVALID_INPUT", "서버 설정이 없습니다", 500);
  return secret;
}
