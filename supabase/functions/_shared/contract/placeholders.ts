import type { Gender } from "./enums.ts";
import { fmt } from "./dates.ts";

export type ClassroomRow = { grade: number; class_no: number; school_year?: number };
export type StudentRow = { number: number; name: string; gender: Gender };
export type RequestFields = {
  reason?: string;
  date4?: string;
  evidence?: Array<"r1" | "r2" | "r3">;
  place?: string;
  content?: string;
  plan?: string;
};
export type RequestRow = {
  category: number | null;
  start_date: string;
  end_date: string;
  period_days: number;
  submitted_on: string;
  report_submitted_on?: string | null;
  report_content?: string | null;
  guardian_name: string;
  fields: RequestFields;
};

export const TYPE1_KEYS = [
  "grade", "class", "번호", "학생명",
  "sY", "sM", "sd", "eY", "eM", "eD", "period",
  "1", "2", "3", "4", "5", "6", "7",
  "1-reason", "2-reason", "3-reason", "4-date", "4-reason",
  "5-reason", "6-reason", "6-r1", "6-r2", "6-r3", "7-reason",
  "yyyy", "M", "d", "name",
] as const;

export const TYPE2_1_KEYS = [
  "grade", "class", "sName", "gender",
  "sY", "sM", "sd", "eY", "eM", "ed", "period",
  "place", "reason", "plan", "yyyy", "M", "d", "aName",
] as const;

export const TYPE2_2_KEYS = [
  "grade", "class", "sName", "gender",
  "sY", "sM", "sd", "eY", "eM", "ed", "period",
  "reason", "yyyy", "M", "d", "aName",
] as const;

export const TYPE2_3_HEAD_KEYS = ["schoolYear", "grade", "class"] as const;
export const TYPE2_3_ROW_KEYS = ["no", "sName", "range", "place", "rptMark", "neisMark", "addpr"] as const;

function box(selected: boolean): string {
  return selected ? "■" : "□";
}

export function toType1Placeholders(r: RequestRow, s: StudentRow, c: ClassroomRow): Record<string, string> {
  const on = (n: number) => r.category === n;
  const f = r.fields;
  const evidence = f.evidence ?? [];
  return {
    grade: String(c.grade),
    class: String(c.class_no),
    번호: String(s.number),
    학생명: s.name,
    sY: fmt(r.start_date, "yyyy"),
    sM: fmt(r.start_date, "M"),
    sd: fmt(r.start_date, "d"),
    eY: fmt(r.end_date, "yyyy"),
    eM: fmt(r.end_date, "M"),
    eD: fmt(r.end_date, "d"),
    period: String(r.period_days),
    ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((n) => [String(n), box(on(n))])),
    "1-reason": on(1) ? f.reason ?? "" : "",
    "2-reason": on(2) ? f.reason ?? "" : "",
    "3-reason": on(3) ? f.reason ?? "" : "",
    "4-date": on(4) && f.date4 ? fmt(f.date4, "yyyy.M.d.") : "",
    "4-reason": on(4) ? f.reason ?? "" : "",
    "5-reason": on(5) ? f.reason ?? "" : "",
    "6-reason": on(6) ? f.reason ?? "" : "",
    "6-r1": on(6) && evidence.includes("r1") ? "○" : "",
    "6-r2": on(6) && evidence.includes("r2") ? "○" : "",
    "6-r3": on(6) && evidence.includes("r3") ? "○" : "",
    "7-reason": on(7) ? f.reason ?? "" : "",
    yyyy: fmt(r.submitted_on, "yyyy"),
    M: fmt(r.submitted_on, "M"),
    d: fmt(r.submitted_on, "d"),
    name: r.guardian_name,
  };
}

export function toType21Placeholders(r: RequestRow, s: StudentRow, c: ClassroomRow): Record<string, string> {
  return {
    grade: String(c.grade),
    class: String(c.class_no),
    sName: s.name,
    gender: s.gender,
    sY: fmt(r.start_date, "yyyy"),
    sM: fmt(r.start_date, "M"),
    sd: fmt(r.start_date, "d"),
    eY: fmt(r.end_date, "yyyy"),
    eM: fmt(r.end_date, "M"),
    ed: fmt(r.end_date, "d"),
    period: String(r.period_days),
    place: r.fields.place ?? "",
    reason: r.fields.content ?? "",
    plan: r.fields.plan ?? "",
    yyyy: fmt(r.submitted_on, "yyyy"),
    M: fmt(r.submitted_on, "M"),
    d: fmt(r.submitted_on, "d"),
    aName: r.guardian_name,
  };
}

export function toType22Placeholders(r: RequestRow, s: StudentRow, c: ClassroomRow): Record<string, string> {
  const submitted = r.report_submitted_on ?? r.submitted_on;
  return {
    grade: String(c.grade),
    class: String(c.class_no),
    sName: s.name,
    gender: s.gender,
    sY: fmt(r.start_date, "yyyy"),
    sM: fmt(r.start_date, "M"),
    sd: fmt(r.start_date, "d"),
    eY: fmt(r.end_date, "yyyy"),
    eM: fmt(r.end_date, "M"),
    ed: fmt(r.end_date, "d"),
    period: String(r.period_days),
    reason: r.report_content ?? "",
    yyyy: fmt(submitted, "yyyy"),
    M: fmt(submitted, "M"),
    d: fmt(submitted, "d"),
    aName: r.guardian_name,
  };
}

export function formatExperienceRange(start: string, end: string, days: number): string {
  const left = fmt(start, "yy.MM.dd.");
  const sameYear = fmt(start, "yyyy") === fmt(end, "yyyy");
  const right = sameYear ? fmt(end, "MM.dd") : fmt(end, "yy.MM.dd");
  return `${left} ~ ${right}(${days}일)`;
}

export type IndexSource = {
  studentName: string;
  studentNumber: number;
  startDate: string;
  endDate: string;
  periodDays: number;
  place: string;
  reportSubmitted: boolean;
  createdAt?: string;
};

export type IndexRow = {
  no: string;
  sName: string;
  range: string;
  place: string;
  rptMark: string;
  neisMark: string;
  addpr: string;
};

/** type2-3 행. 시작일 → 번호 → 생성시각 순으로 정렬하고 학생별 누적 일수를 붙인다. */
export function indexRows(sources: IndexSource[], autoNeis = false): IndexRow[] {
  const sorted = [...sources].sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
    if (a.studentNumber !== b.studentNumber) return a.studentNumber - b.studentNumber;
    return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
  });
  const running = new Map<string, number>();
  return sorted.map((row, index) => {
    const key = `${row.studentNumber}:${row.studentName}`;
    const next = (running.get(key) ?? 0) + row.periodDays;
    running.set(key, next);
    return {
      no: String(index + 1),
      sName: row.studentName,
      range: formatExperienceRange(row.startDate, row.endDate, row.periodDays),
      place: row.place,
      rptMark: row.reportSubmitted ? "○" : "",
      neisMark: autoNeis && row.reportSubmitted ? "○" : "",
      addpr: String(next),
    };
  });
}
