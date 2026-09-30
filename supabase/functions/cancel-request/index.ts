import { cancelInputSchema } from "../_shared/contract/schema.ts";
import { adminClient, parseInput } from "../_shared/db.ts";
import { ApiException, jsonResponse, readJson } from "../_shared/http.ts";
import { serveParent } from "../_shared/serve.ts";
import { requireSession } from "../_shared/session.ts";
import { loadActiveStudent } from "../_shared/students.ts";

serveParent(async (req) => {
  const session = await requireSession(req);
  const input = parseInput(cancelInputSchema, await readJson(req));
  const supabase = adminClient();
  const student = await loadActiveStudent(supabase, session.student_id);

  const { data, error } = await supabase
    .from("requests")
    .update({ status: "cancelled" })
    .eq("id", input.requestId)
    .eq("student_id", student.id)
    .eq("status", "submitted")
    .is("printed_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error(error);
    if (error.code === "23514") throw new ApiException("CONFLICT", "선생님이 이미 처리한 서류입니다", 409);
    throw new ApiException("INVALID_INPUT", "제출을 취소하지 못했습니다", 500);
  }
  if (data) return jsonResponse(req, { id: data.id });

  const { data: existing, error: lookupError } = await supabase
    .from("requests")
    .select("id")
    .eq("id", input.requestId)
    .eq("student_id", student.id)
    .maybeSingle();
  if (lookupError) {
    console.error(lookupError);
    throw new ApiException("INVALID_INPUT", "제출을 취소하지 못했습니다", 500);
  }
  if (!existing) throw new ApiException("NOT_FOUND", "서류를 찾을 수 없습니다", 404);
  throw new ApiException("CONFLICT", "선생님이 이미 처리한 서류입니다", 409);
});
