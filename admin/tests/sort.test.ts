import { describe, expect, it } from 'vitest'
import { printableItems } from '../engine/printSort.ts'
import { indexRows } from '../engine/placeholders.ts'
import type { RequestRecord, Student } from '../engine/types.ts'

const student = (id: string, number: number, name: string): Student => ({
  id, classroomId: 'c', number, name, gender: '남', fatherName: '', motherName: '',
  fatherPhoneLast4: '', motherPhoneLast4: '', active: true,
})

function req(partial: Partial<RequestRecord> & Pick<RequestRecord, 'id' | 'studentId' | 'docType' | 'startDate'>): RequestRecord {
  return {
    classroomId: 'c', category: partial.docType === 'type1' ? 2 : null, endDate: partial.startDate,
    periodDays: 1, submittedOn: partial.startDate, guardianName: '보호자', guardianRelation: 'mother',
    fields: { place: '장소' }, signaturePath: '', reportSubmittedOn: null, reportSignaturePath: null,
    status: 'submitted', rejectReason: null, reviewedAt: null, printedAt: null, reportPrintedAt: null,
    createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z',
    ...partial,
  }
}

describe('print sort', () => {
  it('같은 날이면 번호순, 신청서 다음 보고서', () => {
    const students = [student('a', 5, '홍'), student('b', 2, '이')]
    const requests = [
      req({ id: '1', studentId: 'a', docType: 'type2', startDate: '2026-10-05', reportSubmittedOn: '2026-10-08' }),
      req({ id: '2', studentId: 'b', docType: 'type1', startDate: '2026-10-05', category: 2 }),
      req({ id: '3', studentId: 'b', docType: 'type2', startDate: '2026-10-06' }),
    ]
    const items = printableItems(requests, students, { unprintedOnly: false, includeIndex: true })
    expect(items.map((item) => item.kind)).toEqual(['type1', 'type2-1', 'type2-2', 'type2-1', 'type2-3'])
    expect(items.map((item) => item.studentNumber).slice(0, 4)).toEqual([2, 5, 5, 2])
  })

  it('미출력은 이미 찍힌 신청서를 빼고 보고서만 남긴다', () => {
    const students = [student('a', 1, '김')]
    const requests = [req({
      id: '1', studentId: 'a', docType: 'type2', startDate: '2026-04-06',
      printedAt: '2026-04-06T00:00:00.000Z', reportSubmittedOn: '2026-04-10',
    })]
    const items = printableItems(requests, students, { unprintedOnly: true, includeIndex: false })
    expect(items.map((item) => item.kind)).toEqual(['type2-2'])
  })
})

describe('index cumulative', () => {
  it('같은 학생의 누적 일수를 행마다 더한다', () => {
    const seoyeon = student('s', 8, '박서연')
    const rows = indexRows([
      { student: seoyeon, request: req({ id: 'a', studentId: 's', docType: 'type2', startDate: '2026-04-06', periodDays: 3, createdAt: '2026-04-01T00:00:00.000Z' }) },
      { student: seoyeon, request: req({ id: 'b', studentId: 's', docType: 'type2', startDate: '2026-05-11', periodDays: 5, createdAt: '2026-05-01T00:00:00.000Z' }) },
    ], false)
    expect(rows.map((row) => row.addpr)).toEqual([3, 8])
    expect(rows[1].overCumulative).toBe(false)
    expect(rows[0].range).toContain('(3일)')
  })
})
