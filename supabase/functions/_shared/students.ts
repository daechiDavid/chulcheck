import type { Gender, Relation } from "./contract/enums.ts";
import type { PriorRequest } from "./contract/warnings.ts";
import type { RequestFields } from "./contract/schema.ts";
import { ApiException } from "./http.ts";
import type { AdminClient } from "./db.ts";

export type StudentContext = {
  id: string;
  name: string;
  gender: Gender;
  number: number;
  classroomId: string;
  grade: number;
  classNo: number;
  schoolYear: number;
  fatherName: string | null;
  motherName: string | null;
  fatherHmac: string | null;
  motherHmac: string | null;
};

type ClassroomEmbed = { grade: number; class_no: number; school_year: number };

function classroomOf(value: ClassroomEmbed | ClassroomEmbed[] | null): ClassroomEmbed {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row) throw new ApiException("NOT_FOUND", "학생 정보를 찾을 수 없습니다", 404);
  return row;
}

const STUDENT_COLUMNS =
  "id, name, gender, number, classroom_id, father_name, mother_name, father_phone_hmac, mother_phone_hmac, classrooms!inner(grade, class_no, school_year)";

export function mapStudent(row: Record<string, unknown>): StudentContext {
  const classroom = classroomOf(row.classrooms as ClassroomEmbed | ClassroomEmbed[]);
  return {
    id: String(row.id),
    name: String(row.name),
    gender: row.gender === "남" ? "남" : "여",
    number: Number(row.number),
    classroomId: String(row.classroom_id),
    grade: classroom.grade,
    classNo: classroom.class_no,
    schoolYear: classroom.school_year,
    fatherName: row.father_name == null ? null : String(row.father_name),
    motherName: row.mother_name == null ? null : String(row.mother_name),
    fatherHmac: row.father_phone_hmac == null ? null : String(row.father_phone_hmac),
    motherHmac: row.mother_phone_hmac == null ? null : String(row.mother_phone_hmac),
  };
}

export async function loadActiveStudent(supabase: AdminClient, studentId: string): Promise<StudentContext> {
  const { data, error } = await supabase
    .from("students")
    .select(STUDENT_COLUMNS)
    .eq("id", studentId)
    .eq("active", true)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new ApiException("INVALID_INPUT", "학생 정보를 불러오지 못했습니다", 500);
  }
  if (!data) throw new ApiException("UNAUTHORIZED", "다시 로그인해 주세요", 401);
  return mapStudent(data as Record<string, unknown>);
}

export function relationOf(student: StudentContext, hmac: string): Relation {
  if (student.fatherHmac === hmac) return "father";
  return "mother";
}

export async function loadPriorRequests(
  supabase: AdminClient,
  studentId: string,
  excludeId?: string,
): Promise<PriorRequest[]> {
  const query = supabase
    .from("requests")
    .select("doc_type, category, start_date, period_days, status, submitted_on")
    .eq("student_id", studentId);
  const filtered = excludeId ? query.neq("id", excludeId) : query;
  const { data, error } = await filtered;
  if (error) {
    console.error(error);
    throw new ApiException("INVALID_INPUT", "제출 기록을 불러오지 못했습니다", 500);
  }
  return (data ?? []).map((row) => ({
    docType: row.doc_type,
    category: row.category,
    startDate: row.start_date,
    periodDays: row.period_days,
    status: row.status,
    submittedOn: row.submitted_on,
  }));
}

export async function loadOffDayDates(
  supabase: AdminClient,
  start: string,
  end: string,
): Promise<string[]> {
  const { data, error } = await supabase.from("off_days").select("date").gte("date", start).lte("date", end);
  if (error) {
    console.error(error);
    throw new ApiException("INVALID_INPUT", "휴업일을 불러오지 못했습니다", 500);
  }
  return (data ?? []).map((row) => row.date);
}

export function asFields(value: unknown): RequestFields {
  if (!value || typeof value !== "object") {
    throw new ApiException("INVALID_INPUT", "서류 내용이 올바르지 않습니다", 400);
  }
  return value as RequestFields;
}
