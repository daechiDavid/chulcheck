import { syncHolidaysInputSchema } from "../_shared/contract/schema.ts";
import { parseInput } from "../_shared/db.ts";
import { ApiException, jsonResponse, readJson } from "../_shared/http.ts";
import { serveTeacher, serviceDb } from "../_shared/teacher.ts";

type Holiday = { date: string; label: string };

serveTeacher(async (req, teacherId) => {
  const input = parseInput(syncHolidaysInputSchema, await readJson(req));
  const supabase = serviceDb();
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("id")
    .eq("id", teacherId)
    .maybeSingle();
  if (teacherError) {
    console.error(teacherError);
    throw new ApiException("INVALID_INPUT", "교사 정보를 확인하지 못했습니다", 500);
  }
  if (!teacher) throw new ApiException("FORBIDDEN", "교사 정보를 먼저 등록해 주세요", 403);

  const key = Deno.env.get("DATA_GO_KR_KEY");
  if (!key) throw new ApiException("INVALID_INPUT", "공휴일 API 키가 서버에 없습니다", 500);

  const holidays = new Map<string, Holiday>();
  for (const [year, month] of schoolYearMonths(input.schoolYear)) {
    for (const holiday of await fetchMonth(key, year, month)) holidays.set(holiday.date, holiday);
  }
  const dates = [...holidays.keys()];
  if (!dates.length) return jsonResponse(req, { upserted: 0, skippedSchoolOff: 0 });

  const { data: existing, error: existingError } = await supabase
    .from("off_days")
    .select("date, kind")
    .in("date", dates);
  if (existingError) {
    console.error(existingError);
    throw new ApiException("INVALID_INPUT", "휴업일을 확인하지 못했습니다", 500);
  }
  const blocked = new Set((existing ?? []).filter((row) => row.kind === "school_off").map((row) => row.date));
  const rows = [...holidays.values()]
    .filter((holiday) => !blocked.has(holiday.date))
    .map((holiday) => ({ date: holiday.date, kind: "holiday" as const, label: holiday.label }));
  if (rows.length) {
    const { error } = await supabase.from("off_days").upsert(rows, { onConflict: "date" });
    if (error) {
      console.error(error);
      throw new ApiException("INVALID_INPUT", "공휴일을 저장하지 못했습니다", 500);
    }
  }
  return jsonResponse(req, { upserted: rows.length, skippedSchoolOff: blocked.size });
});

function schoolYearMonths(schoolYear: number): Array<[number, number]> {
  const months: Array<[number, number]> = [];
  for (let month = 3; month <= 12; month += 1) months.push([schoolYear, month]);
  for (let month = 1; month <= 2; month += 1) months.push([schoolYear + 1, month]);
  return months;
}

async function fetchMonth(key: string, year: number, month: number): Promise<Holiday[]> {
  const serviceKey = key.includes("%") ? key : encodeURIComponent(key);
  const monthText = String(month).padStart(2, "0");
  const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${serviceKey}&solYear=${year}&solMonth=${monthText}&numOfRows=100&_type=json`;
  const response = await fetch(url);
  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ApiException("INVALID_INPUT", "공휴일 API 응답을 읽지 못했습니다. 키를 확인해 주세요", 502);
  }
  const root = asRecord(asRecord(payload).response);
  const header = asRecord(root.header);
  const code = String(header.resultCode ?? "");
  if (code !== "00") {
    const message = String(header.resultMsg ?? "공휴일 API가 거절했습니다");
    throw new ApiException("INVALID_INPUT", message, 502);
  }
  const body = asRecord(root.body);
  return itemsOf(body.items).flatMap((item) => {
    if (String(item.isHoliday ?? "") !== "Y") return [];
    const date = toIso(item.locdate);
    if (!date) return [];
    const label = String(item.dateName ?? "공휴일").trim() || "공휴일";
    return [{ date, label }];
  });
}

function itemsOf(value: unknown): Array<Record<string, unknown>> {
  const item = asRecord(value).item;
  if (!item) return [];
  if (Array.isArray(item)) return item.map(asRecord);
  return [asRecord(item)];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toIso(locdate: unknown): string | null {
  const digits = String(locdate ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}
