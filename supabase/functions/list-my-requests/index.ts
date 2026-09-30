import { adminClient } from "../_shared/db.ts";
import { ApiException, jsonResponse } from "../_shared/http.ts";
import { serveParent } from "../_shared/serve.ts";
import { requireSession } from "../_shared/session.ts";
import { asFields, loadActiveStudent } from "../_shared/students.ts";

serveParent(async (req) => {
  const session = await requireSession(req);
  const supabase = adminClient();
  const student = await loadActiveStudent(supabase, session.student_id);
  const { data, error } = await supabase
    .from("requests")
    .select(
      "id, doc_type, category, start_date, end_date, period_days, submitted_on, status, reject_reason, printed_at, report_printed_at, report_submitted_on, report_content, report_evidence_paths, guardian_name, guardian_relation, fields",
    )
    .eq("student_id", student.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    throw new ApiException("INVALID_INPUT", "제출 내역을 불러오지 못했습니다", 500);
  }
  return jsonResponse(
    req,
    (data ?? []).map((row) => ({
      id: row.id,
      docType: row.doc_type,
      category: row.category,
      startDate: row.start_date,
      endDate: row.end_date,
      periodDays: row.period_days,
      submittedOn: row.submitted_on,
      status: row.status,
      rejectReason: row.reject_reason,
      printed: row.printed_at != null,
      reportPrinted: row.report_printed_at != null,
      reportSubmittedOn: row.report_submitted_on,
      reportContent: row.report_content ?? "",
      reportEvidencePaths: row.report_evidence_paths ?? [],
      guardianName: row.guardian_name,
      guardianRelation: row.guardian_relation,
      fields: asFields(row.fields),
    })),
  );
});
