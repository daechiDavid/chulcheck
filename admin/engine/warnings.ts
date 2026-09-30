import { addDaysYmd, compareYmd, schoolYearOf } from './dates.ts'
import { periodDays } from './period.ts'
import type { RequestRecord, Student, Warning } from './types.ts'

const ACTIVE = new Set(['submitted', 'reviewed'])

export function warningsFor(
  request: RequestRecord,
  student: Student | undefined,
  siblings: RequestRecord[],
  offDays: string[],
): Warning[] {
  const warnings: Warning[] = []
  const days = request.periodDays

  if (request.docType === 'type1') {
    const category = request.category
    if (category === 1 && days < 3) {
      warnings.push({ code: 'TYPE1_DAYS', message: '1번(3일 이상)인데 결석일수가 3일 미만입니다.' })
    }
    if ((category === 2 || category === 3) && days > 2) {
      warnings.push({ code: 'TYPE1_DAYS', message: '2·3번(2일 이하)인데 결석일수가 2일을 넘습니다.' })
    }
    if (category === 6) {
      const evidence = request.fields.evidence ?? []
      const limits: number[] = []
      if (evidence.includes('r1')) limits.push(1)
      if (evidence.includes('r2')) limits.push(5)
      const cap = limits.length ? Math.max(...limits) : null
      if (cap != null && days > cap) {
        warnings.push({
          code: 'FAMILY_DAYS',
          message: `경조사 인정 일수(${cap}일)를 넘었습니다.`,
        })
      }
    }
    if (category === 7 && student?.gender === '남') {
      warnings.push({ code: 'MENSTRUAL_MALE', message: '생리결석이 남학생에게 제출되어 있습니다.' })
    }
    if (category === 7 && student) {
      const month = request.startDate.slice(0, 7)
      const dup = siblings.some(
        (other) =>
          other.id !== request.id &&
          other.studentId === request.studentId &&
          other.docType === 'type1' &&
          other.category === 7 &&
          ACTIVE.has(other.status) &&
          other.startDate.slice(0, 7) === month,
      )
      if (dup) warnings.push({ code: 'MENSTRUAL_MONTH', message: '같은 달에 생리결석 제출이 이미 있습니다.' })
    }
    const lateStart = addDaysYmd(request.endDate, 1)
    if (compareYmd(request.submittedOn, request.endDate) > 0) {
      const gap = periodDays(lateStart, request.submittedOn, offDays)
      if (gap > 5) {
        warnings.push({ code: 'LATE_SUBMIT', message: '결석 종료 후 제출까지 수업일이 5일을 넘었습니다.' })
      }
    }
  }

  if (request.docType === 'type2') {
    const dayBefore = addDaysYmd(request.startDate, -1)
    if (compareYmd(request.submittedOn, dayBefore) > 0) {
      warnings.push({ code: 'TYPE2_LATE', message: '신청일이 체험학습 시작 전날보다 늦습니다.' })
    }
    if (days > 10) {
      warnings.push({ code: 'TYPE2_STREAK', message: '연속 체험학습 일수가 10일을 넘습니다.' })
    }
    const year = schoolYearOf(request.startDate)
    const cumulative = siblings
      .filter(
        (other) =>
          other.studentId === request.studentId &&
          other.docType === 'type2' &&
          other.status !== 'rejected' &&
          other.status !== 'cancelled' &&
          schoolYearOf(other.startDate) === year &&
          (compareYmd(other.startDate, request.startDate) < 0 ||
            (other.startDate === request.startDate && other.createdAt <= request.createdAt)),
      )
      .reduce((sum, other) => sum + other.periodDays, 0)
    if (cumulative > 19) {
      warnings.push({
        code: 'TYPE2_CUMULATIVE',
        message: `학년도 누적 체험학습이 ${cumulative}일로 19일을 넘습니다.`,
      })
    }
  }

  return warnings
}
