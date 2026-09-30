import { computeWarnings, type WarningInput } from "../_shared/contract/warnings.ts";
import { periodDays } from "../_shared/contract/period.ts";
import {
  fieldsSchemaForCategory,
  teacherUpdateInputSchema,
  type2FieldsSchema,
} from "../_shared/contract/schema.ts";
import { parseInput } from "../_shared/db.ts";
import { ApiException, jsonResponse, readJson } from "../_shared/http.ts";
import { loadOffDayDates, loadPriorRequests } from "../_shared/students.ts";
import { assertClassroomOwner, serveTeacher, serviceDb } from "../_shared/teacher.ts";

serveTeacher(async (req, teacherId) => {
  const input = parseInput(teacherUpdateInputSchema, await readJson(req));
  const supabase = serviceDb();
  const { data: request, error } = await supabase
    .from("requests")
    .select("id, student_id, classroom_id, doc_type, category, start_date, end_date, submitted_on, status, fields, guardian_name")
    .eq("id", input.requestId)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new ApiException("INVALID_INPUT", "신청을 불러오지 못했습니다", 500);
  }
  if (!request) throw new ApiException("NOT_FOUND", "신청을 찾을 수 없습니다", 404);
  await assertClassroomOwner(supabase, request.classroom_id, teacherId);
  if (request.status === "cancelled" || request.status === "rejected") {
    throw new ApiException("CONFLICT", "취소·반려된 신청은 수정할 수 없습니다", 409);
  }

  const startDate = input.startDate ?? request.start_date;
  const endDate = input.endDate ?? request.end_date;
  if (endDate < startDate) {
    throw new ApiException("INVALID_INPUT", "종료일은 시작일 이후여야 합니다", 400);
  }
  const category = input.category === undefined ? request.category : input.category;
  if (request.doc_type === "type2" && category != null) {
    throw new ApiException("INVALID_INPUT", "체험학습에는 사유 번호가 없습니다", 400);
  }
  if (request.doc_type === "type1" && (category == null || category < 1 || category > 7)) {
    throw new ApiException("INVALID_INPUT", "사유를 선택해 주세요", 400);
  }

  const merged = input.fields === undefined
    ? request.fields
    : { ...(asRecord(request.fields)), ...asRecord(input.fields) };
  const fields = request.doc_type === "type1"
    ? parseFields(fieldsSchemaForCategory(category as number), merged)
    : parseFields(type2FieldsSchema, merged);

  const from = startDate < request.submitted_on ? startDate : request.submitted_on;
  const to = endDate > request.submitted_on ? endDate : request.submitted_on;
  const offDays = await loadOffDayDates(supabase, from, to);
  const days = periodDays(startDate, endDate, offDays);
  if (days <= 0) throw new ApiException("INVALID_INPUT", "수업일수가 0일입니다. 기간을 확인해 주세요", 400);

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("gender")
    .eq("id", request.student_id)
    .maybeSingle();
  if (studentError || !student) {
    console.error(studentError);
    throw new ApiException("NOT_FOUND", "학생을 찾을 수 없습니다", 404);
  }

  const guardianName = input.guardianName?.trim() || request.guardian_name;
  const { error: updateError } = await supabase.from("requests").update({
    start_date: startDate,
    end_date: endDate,
    period_days: days,
    category,
    fields,
    guardian_name: guardianName,
  }).eq("id", request.id);
  if (updateError) {
    console.error(updateError);
    throw new ApiException("INVALID_INPUT", "신청 내용을 저장하지 못했습니다", 500);
  }

  const prior = await loadPriorRequests(supabase, request.student_id, request.id);
  const warnings = computeWarnings({
    docType: request.doc_type,
    category,
    startDate,
    endDate,
    periodDays: days,
    submittedOn: request.submitted_on,
    gender: student.gender === "남" ? "남" : "여",
    fields: fields as WarningInput["fields"],
    offDays,
    prior,
  });
  return jsonResponse(req, { id: request.id, periodDays: days, warnings });
});

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseFields(
  schema: { safeParse: (data: unknown) => { success: boolean; data?: unknown; error?: { issues: Array<{ message: string }> } } },
  data: unknown,
): Record<string, unknown> {
  const parsed = schema.safeParse(data);
  if (!parsed.success || !parsed.data || typeof parsed.data !== "object") {
    throw new ApiException("INVALID_INPUT", parsed.error?.issues[0]?.message ?? "내용을 확인해 주세요", 400);
  }
  return parsed.data as Record<string, unknown>;
}
