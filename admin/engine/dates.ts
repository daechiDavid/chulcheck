const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export function todayKST(now = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS)
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function schoolYearOf(ymd: string): number {
  const month = Number(ymd.slice(5, 7))
  const year = Number(ymd.slice(0, 4))
  return month >= 3 ? year : year - 1
}

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function formatYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDaysYmd(ymd: string, days: number): string {
  const date = parseYmd(ymd)
  date.setDate(date.getDate() + days)
  return formatYmd(date)
}

export function compareYmd(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function eachDate(start: string, end: string): string[] {
  const out: string[] = []
  if (compareYmd(start, end) > 0) return out
  let cursor = start
  while (compareYmd(cursor, end) <= 0) {
    out.push(cursor)
    cursor = addDaysYmd(cursor, 1)
    if (out.length > 400) break
  }
  return out
}

export function unpadded(ymd: string): { y: string; m: string; d: string } {
  return {
    y: ymd.slice(0, 4),
    m: String(Number(ymd.slice(5, 7))),
    d: String(Number(ymd.slice(8, 10))),
  }
}

export function formatDotDate(ymd: string): string {
  const p = unpadded(ymd)
  return `${p.y}.${p.m}.${p.d}.`
}
