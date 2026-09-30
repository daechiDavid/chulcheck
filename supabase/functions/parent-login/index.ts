import { loginInputSchema } from "../_shared/contract/schema.ts";
import { adminClient, parseInput, requirePepper, requireSessionSecret } from "../_shared/db.ts";
import { ApiException, clientIp, jsonResponse, readJson } from "../_shared/http.ts";
import { normalizePhone, phoneHmac } from "../_shared/phone.ts";
import { serveParent } from "../_shared/serve.ts";
import { signSession } from "../_shared/session.ts";
import { mapStudent, relationOf, type StudentContext } from "../_shared/students.ts";

const LOCK_WINDOW_MS = 10 * 60 * 1000;
const LOCK_LIMIT = 5;

serveParent(async (req) => {
  const input = parseInput(loginInputSchema, await readJson(req));
  const phone = normalizePhone(input.phone);
  if (!phone) throw new ApiException("INVALID_INPUT", "전화번호 형식을 확인해 주세요", 400);

  const supabase = adminClient();
  const nameKey = `name:${input.studentName}`;
  const ipKey = `ip:${clientIp(req)}`;
  if (await isLocked(supabase, nameKey) || await isLocked(supabase, ipKey)) {
    throw new ApiException("LOCKED", "로그인을 여러 번 시도했습니다. 10분 후에 다시 시도해 주세요.", 429);
  }

  const hmac = await phoneHmac(phone, requirePepper());
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, name, gender, number, classroom_id, father_name, mother_name, father_phone_hmac, mother_phone_hmac, classrooms!inner(grade, class_no, school_year)",
    )
    .eq("name", input.studentName)
    .eq("active", true)
    .or(`father_phone_hmac.eq.${hmac},mother_phone_hmac.eq.${hmac}`);

  if (error) {
    console.error(error);
    throw new ApiException("INVALID_INPUT", "로그인에 실패했습니다", 500);
  }

  const rows = latestSchoolYear((data ?? []).map((row) => mapStudent(row as Record<string, unknown>)));
  if (rows.length === 0) {
    await recordAttempt(supabase, [nameKey, ipKey], false);
    throw new ApiException("UNAUTHORIZED", "학생 이름 또는 전화번호가 일치하지 않습니다", 401);
  }
  if (rows.length > 1) {
    await recordAttempt(supabase, [nameKey, ipKey], false);
    throw new ApiException(
      "AMBIGUOUS_STUDENT",
      "같은 정보의 학생이 둘 이상입니다. 담임선생님께 문의해 주세요.",
      409,
    );
  }

  const student = rows[0];
  const relation = relationOf(student, hmac);
  const signed = await signSession({ student_id: student.id, relation }, requireSessionSecret());
  await recordAttempt(supabase, [nameKey, ipKey], true);

  return jsonResponse(req, {
    token: signed.token,
    expiresAt: new Date(signed.exp * 1000).toISOString(),
    student: {
      grade: student.grade,
      classNo: student.classNo,
      number: student.number,
      name: student.name,
      gender: student.gender,
    },
    guardianNameDefault: (relation === "father" ? student.fatherName : student.motherName) ?? "",
    relation,
  });
});

/** 지난 학년도 학급에 남은 같은 학생 때문에 로그인이 막히지 않도록 가장 최근 학년도만 남긴다. */
function latestSchoolYear(students: StudentContext[]): StudentContext[] {
  const newest = Math.max(...students.map((student) => student.schoolYear));
  return students.filter((student) => student.schoolYear === newest);
}

async function isLocked(supabase: ReturnType<typeof adminClient>, key: string): Promise<boolean> {
  const since = new Date(Date.now() - LOCK_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("key", key)
    .eq("success", false)
    .gte("attempted_at", since);
  if (error) {
    console.error(error);
    throw new ApiException("INVALID_INPUT", "로그인에 실패했습니다", 500);
  }
  return (count ?? 0) >= LOCK_LIMIT;
}

async function recordAttempt(supabase: ReturnType<typeof adminClient>, keys: string[], success: boolean) {
  const { error } = await supabase.from("login_attempts").insert(keys.map((key) => ({ key, success })));
  if (error) console.error(error);
}
