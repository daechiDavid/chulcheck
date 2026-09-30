import { addDays as addDaysDate, format, getDay } from "date-fns";

/** 날짜 문자열을 그 달력 날짜의 정오로 만든다. 시간대와 무관하게 연·월·일이 유지된다. */
export function asDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function formatIso(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function addDays(iso: string, days: number): string {
  return formatIso(addDaysDate(asDate(iso), days));
}

/** 0=일요일 … 6=토요일 */
export function weekday(iso: string): number {
  return getDay(asDate(iso));
}

export function fmt(iso: string, pattern: string): string {
  return format(asDate(iso), pattern);
}

/** Edge Function은 UTC로 돈다. 오늘 날짜는 이 함수만 사용한다. */
export function todayKST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 체험학습은 실시 전날 16:00 KST까지 제출해야 하므로, 마감 시각에 따라 가장 빠른 시작일을 돌려준다. */
export function earliestFieldTripStartDate(now: Date = new Date()): string {
  const today = todayKST(now);
  const deadline = Date.parse(`${today}T16:00:00+09:00`);
  return addDays(today, now.getTime() <= deadline ? 1 : 2);
}

/** 학년도: 3월 1일 ~ 다음 해 2월 말. 3월 이후는 그 해, 1~2월은 전년도. */
export function schoolYearOf(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return m >= 3 ? y : y - 1;
}

export function schoolYearRange(year: number): { start: string; end: string } {
  const endYear = year + 1;
  const leap = endYear % 4 === 0 && (endYear % 100 !== 0 || endYear % 400 === 0);
  return { start: `${year}-03-01`, end: `${endYear}-02-${leap ? "29" : "28"}` };
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
