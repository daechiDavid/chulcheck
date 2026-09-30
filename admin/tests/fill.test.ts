import { describe, expect, it } from 'vitest'
import { formatRange, type1Values } from '../engine/placeholders.ts'
import type { Classroom, RequestRecord, Student } from '../engine/types.ts'
import { fillXml } from '../engine/hwpx/fill.ts'

const classroom: Classroom = { id: 'c', teacherId: 't', schoolYear: 2026, grade: 3, classNo: 2 }
const student: Student = {
  id: 's', classroomId: 'c', number: 5, name: '홍길동', gender: '남',
  fatherName: '홍판서', motherName: '홍부인', fatherPhoneLast4: '1111', motherPhoneLast4: '2222', active: true,
}

function request(partial: Partial<RequestRecord>): RequestRecord {
  return {
    id: 'r', studentId: 's', classroomId: 'c', docType: 'type1', category: 6,
    startDate: '2026-10-05', endDate: '2026-10-07', periodDays: 3, submittedOn: '2026-10-04',
    guardianName: '홍부인', guardianRelation: 'mother', fields: { reason: '조부 별세', evidence: ['r2'] },
    signaturePath: '', reportSubmittedOn: null, reportSignaturePath: null, status: 'submitted',
    rejectReason: null, reviewedAt: null, printedAt: null, reportPrintedAt: null,
    createdAt: '2026-10-04T00:00:00.000Z', updatedAt: '2026-10-04T00:00:00.000Z',
    ...partial,
  }
}

describe('placeholders', () => {
  it('경조사 선택 칸과 증빙만 채운다', () => {
    const values = type1Values(request({}), student, classroom)
    expect(values['6']).toBe('■')
    expect(values['1']).toBe('□')
    expect(values['6-r2']).toBe('○')
    expect(values['6-r1']).toBe('')
    expect(values['1-reason']).toBe('')
    expect(values['6-reason']).toBe('조부 별세')
    expect(values.period).toBe('3')
  })

  it('색인 기간은 같은 해와 넘긴 해를 구분한다', () => {
    expect(formatRange('2026-10-05', '2026-10-07', 3)).toBe('26.10.05. ~ 10.07(3일)')
    expect(formatRange('2026-12-30', '2027-01-04', 2)).toBe('26.12.30. ~ 27.01.04(2일)')
  })
})

describe('fillXml', () => {
  it('특수문자와 줄바꿈을 넣고 남은 키를 실패로 본다', () => {
    const xml = '<hp:p><hp:run><hp:t>{{reason}}</hp:t></hp:run><hp:linesegarray><hp:lineseg/></hp:linesegarray></hp:p>'
    const filled = fillXml(xml, { reason: 'A & B\n<다음>' })
    expect(filled).toContain('A &amp; B</hp:t><hp:lineBreak/><hp:t>&lt;다음&gt;')
    expect(filled).not.toContain('linesegarray')
    expect(() => fillXml(xml, {})).toThrow(/reason/)
  })
})
