import { earliestFieldTripStartDate, todayKST } from "../_shared/contract/dates.ts";
import { periodDays } from "../_shared/contract/period.ts";
import { requestInputSchema } from "../_shared/contract/schema.ts";
import { computeWarnings } from "../_shared/contract/warnings.ts";
import { adminClient, assertOwnSignature, parseInput } from "../_shared/db.ts";
import { ApiException, jsonResponse, readJson } from "../_shared/http.ts";
import { serveParent } from "../_shared/serve.ts";
import { requireSession } from "../_shared/session.ts";
import { loadActiveStudent, loadOffDayDates, loadPriorRequests } from "../_shared/students.ts";

serveParent(async (req) => {
  const session = await requireSession(req);
  const input = parseInput(requestInputSchema, await readJson(req));
  if (input.docType === "type2" && input.startDate < earliestFieldTripStartDate()) {
    throw new ApiException("INVALID_INPUT", "체험학습 신청은 실시 전날 16:00까지 제출해야 합니다. 시작일을 다시 선택해 주세요.", 400);
  }
  const supabase = adminClient();
  const student = await loadActiveStudent(supabase, session.student_id);
  assertOwnSignature(input.signaturePath, student.classroomId, student.id);
  if (input.docType === "type1" && input.category === 7 && student.gender === "남") {
    throw new ApiException("INVALID_INPUT", "생리결석은 여학생만 선택할 수 있습니다", 400);
  }

  const submittedOn = todayKST();
  const from = input.startDate < submittedOn ? input.startDate : submittedOn;
  const to = input.endDate > submittedOn ? input.endDate : submittedOn;
  const offDays = await loadOffDayDates(supabase, from, to);
  const days = periodDays(input.startDate, input.endDate, offDays);
  if (days <= 0) throw new ApiException("INVALID_INPUT", "선택한 기간에 수업일이 없습니다", 400);

  const prior = await loadPriorRequests(supabase, student.id);
  const warnings = computeWarnings({
    docType: input.docType,
    category: input.category,
    startDate: input.startDate,
    endDate: input.endDate,
    periodDays: days,
    submittedOn,
    gender: student.gender,
    fields: input.fields,
    offDays,
    prior,
  });

  const { data, error } = await supabase
    .from("requests")
    .insert({
      student_id: student.id,
      classroom_id: student.classroomId,
      doc_type: input.docType,
      category: input.category,
      start_date: input.startDate,
      end_date: input.endDate,
      period_days: days,
      submitted_on: submittedOn,
      guardian_name: input.guardianName,
      guardian_relation: session.relation,
      fields: input.fields,
      signature_path: input.signaturePath,
      status: "submitted",
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error(error);
    throw new ApiException("INVALID_INPUT", "서류를 저장하지 못했습니다", 500);
  }
  return jsonResponse(req, { id: data.id, periodDays: days, warnings });
});
