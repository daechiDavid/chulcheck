import { todayKST } from "../_shared/contract/dates.ts";
import { reportInputSchema } from "../_shared/contract/schema.ts";
import { adminClient, assertOwnSignature, parseInput } from "../_shared/db.ts";
import { ApiException, jsonResponse, readJson } from "../_shared/http.ts";
import { serveParent } from "../_shared/serve.ts";
import { requireSession } from "../_shared/session.ts";
import { loadActiveStudent } from "../_shared/students.ts";

const MAX_PHOTO_BYTES = 350 * 1024;

serveParent(async (req) => {
  const session = await requireSession(req);
  const input = parseInput(reportInputSchema, await readJson(req));
  const supabase = adminClient();
  const student = await loadActiveStudent(supabase, session.student_id);
  assertOwnSignature(input.signaturePath, student.classroomId, student.id);

  const { data: row, error } = await supabase
    .from("requests")
    .select("id, student_id, classroom_id, doc_type, status, end_date, report_submitted_on")
    .eq("id", input.requestId)
    .eq("student_id", student.id)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new ApiException("INVALID_INPUT", "신청서를 불러오지 못했습니다", 500);
  }
  if (!row) throw new ApiException("NOT_FOUND", "신청서를 찾을 수 없습니다", 404);
  if (row.doc_type !== "type2") throw new ApiException("INVALID_INPUT", "체험학습 신청서만 보고서를 제출할 수 있습니다", 400);
  if (row.report_submitted_on) throw new ApiException("CONFLICT", "이미 보고서가 제출되었습니다", 409);
  if (row.status !== "submitted" && row.status !== "reviewed") {
    throw new ApiException("CONFLICT", "선생님이 이미 처리한 서류입니다", 409);
  }
  const today = todayKST();
  if (row.end_date > today) {
    throw new ApiException("INVALID_INPUT", "체험학습이 끝난 뒤에 보고서를 제출할 수 있습니다", 400);
  }

  const uploadedPaths: string[] = [];
  try {
    for (const photo of input.evidencePhotos) {
      const bytes = decodeJpeg(photo);
      const path = `${student.classroomId}/${student.id}/${row.id}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("report-evidence").upload(path, bytes, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (uploadError) {
        console.error(uploadError);
        throw new ApiException("INVALID_INPUT", "증빙 사진을 저장하지 못했습니다", 500);
      }
      uploadedPaths.push(path);
    }

    const { data: updated, error: updateError } = await supabase
      .from("requests")
      .update({
        report_submitted_on: today,
        report_signature_path: input.signaturePath,
        report_content: input.experienceSummary,
        report_evidence_paths: uploadedPaths,
      })
      .eq("id", row.id)
      .eq("student_id", student.id)
      .is("report_submitted_on", null)
      .select("id, report_submitted_on")
      .maybeSingle();
    if (updateError) {
      console.error(updateError);
      throw new ApiException("INVALID_INPUT", "보고서를 저장하지 못했습니다", 500);
    }
    if (!updated) throw new ApiException("CONFLICT", "선생님이 이미 처리한 서류입니다", 409);
    return jsonResponse(req, { id: updated.id, reportSubmittedOn: updated.report_submitted_on });
  } catch (error) {
    if (uploadedPaths.length) {
      const { error: removeError } = await supabase.storage.from("report-evidence").remove(uploadedPaths);
      if (removeError) console.error(removeError);
    }
    throw error;
  }
});

function decodeJpeg(input: string): Uint8Array {
  const prefix = "data:image/jpeg;base64,";
  const raw = input.startsWith(prefix) ? input.slice(prefix.length) : "";
  let binary: string;
  try {
    binary = atob(raw);
  } catch {
    throw new ApiException("INVALID_INPUT", "사진을 읽지 못했습니다", 400);
  }
  if (!binary.length || binary.length > MAX_PHOTO_BYTES) {
    throw new ApiException("INVALID_INPUT", "사진 한 장은 350KB 이하여야 합니다", 400);
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new ApiException("INVALID_INPUT", "JPEG 사진만 첨부할 수 있습니다", 400);
  }
  return bytes;
}
