import { eachDate, parseYmd } from './dates.ts'

function isWeekend(ymd: string): boolean {
  const day = parseYmd(ymd).getDay()
  return day === 0 || day === 6
}

/** 시작·끝 포함, 토·일과 offDays를 뺀 수업일수. */
export function periodDays(start: string, end: string, offDays: Iterable<string> = []): number {
  const off = new Set(offDays)
  let count = 0
  for (const day of eachDate(start, end)) {
    if (isWeekend(day) || off.has(day)) continue
    count += 1
  }
  return count
}
