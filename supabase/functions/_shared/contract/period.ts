import { addDays, weekday } from "./dates.ts";

/**
 * 시작일~종료일(양 끝 포함) 중 토·일과 offDays를 뺀 수업일수.
 * offDays는 'YYYY-MM-DD'.
 */
export function periodDays(start: string, end: string, offDays: Iterable<string>): number {
  if (end < start) return 0;
  const off = offDays instanceof Set ? offDays : new Set(offDays);
  let count = 0;
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const day = weekday(cursor);
    if (day === 0 || day === 6) continue;
    if (off.has(cursor)) continue;
    count += 1;
  }
  return count;
}
