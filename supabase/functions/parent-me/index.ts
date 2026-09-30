import { schoolYearOf, schoolYearRange, todayKST } from "../_shared/contract/dates.ts";
import { adminClient } from "../_shared/db.ts";
import { ApiException, jsonResponse } from "../_shared/http.ts";
import { serveParent } from "../_shared/serve.ts";
import { requireSession } from "../_shared/session.ts";
import { loadActiveStudent } from "../_shared/students.ts";

serveParent(async (req) => {
  const session = await requireSession(req);
  const supabase = adminClient();
  const student = await loadActiveStudent(supabase, session.student_id);
  const range = schoolYearRange(schoolYearOf(todayKST()));
  const { data, error } = await supabase
    .from("off_days")
    .select("date, kind, label")
    .gte("date", range.start)
    .lte("date", range.end)
    .order("date");
  if (error) {
    console.error(error);
    throw new ApiException("INVALID_INPUT", "휴업일을 불러오지 못했습니다", 500);
  }
  return jsonResponse(req, {
    student: {
      grade: student.grade,
      classNo: student.classNo,
      number: student.number,
      name: student.name,
      gender: student.gender,
    },
    offDays: (data ?? []).map((row) => ({ date: row.date, kind: row.kind, label: row.label })),
  });
});
