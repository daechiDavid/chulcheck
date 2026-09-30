import { createClient } from "@supabase/supabase-js";
import { adminClient, type AdminClient } from "./db.ts";
import { ApiException, errorResponse, handleOptions } from "./http.ts";

export async function requireTeacherId(req: Request): Promise<string> {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    throw new ApiException("UNAUTHORIZED", "다시 로그인해 주세요", 401);
  }
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) throw new ApiException("INVALID_INPUT", "서버 설정이 없습니다", 500);
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: header } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new ApiException("UNAUTHORIZED", "다시 로그인해 주세요", 401);
  return data.user.id;
}

export async function assertClassroomOwner(
  supabase: AdminClient,
  classroomId: string,
  teacherId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("classrooms")
    .select("id, teacher_id")
    .eq("id", classroomId)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new ApiException("INVALID_INPUT", "학급을 확인하지 못했습니다", 500);
  }
  if (!data || data.teacher_id !== teacherId) {
    throw new ApiException("FORBIDDEN", "이 학급을 다룰 수 없습니다", 403);
  }
}

export function serveTeacher(handler: (req: Request, teacherId: string) => Promise<Response>): void {
  Deno.serve(async (req) => {
    try {
      const options = handleOptions(req);
      if (options) return options;
      if (req.method !== "POST") {
        return errorResponse(req, "INVALID_INPUT", "POST만 가능합니다", 405);
      }
      const teacherId = await requireTeacherId(req);
      return await handler(req, teacherId);
    } catch (error) {
      if (error instanceof ApiException) return errorResponse(req, error.code, error.message, error.status);
      console.error(error);
      return errorResponse(req, "INVALID_INPUT", "요청을 처리하지 못했습니다", 500);
    }
  });
}

export function serviceDb(): AdminClient {
  return adminClient();
}
