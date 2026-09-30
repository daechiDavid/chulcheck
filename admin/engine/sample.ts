import { periodDays } from './period.ts'
import { randomId } from './password.ts'
import type { DbState, RequestRecord, Student } from './types.ts'

export function seedSample(state: DbState): DbState {
  if (!state.classroom || !state.teacher) throw new Error('학급 설정 후 샘플을 넣을 수 있습니다.')
  const classroomId = state.classroom.id
  const existing = new Map(state.students.map((student) => [student.number, student]))
  const specs: Array<Omit<Student, 'id' | 'classroomId' | 'active'>> = [
    { number: 1, name: '김하늘', gender: '여', fatherName: '김도윤', motherName: '이수진', fatherPhoneLast4: '1101', motherPhoneLast4: '2201' },
    { number: 2, name: '이준호', gender: '남', fatherName: '이성민', motherName: '박지영', fatherPhoneLast4: '1102', motherPhoneLast4: '2202' },
    { number: 5, name: '홍길동', gender: '남', fatherName: '홍판서', motherName: '홍부인', fatherPhoneLast4: '1105', motherPhoneLast4: '2205' },
    { number: 8, name: '박서연', gender: '여', fatherName: '박준혁', motherName: '최은정', fatherPhoneLast4: '1108', motherPhoneLast4: '2208' },
    { number: 12, name: '최민재', gender: '남', fatherName: '최강호', motherName: '정미래', fatherPhoneLast4: '1112', motherPhoneLast4: '2212' },
  ]
  const students = [...state.students]
  const byNumber = (number: number) => {
    const found = existing.get(number) ?? students.find((student) => student.number === number)
    if (found) return found
    const spec = specs.find((item) => item.number === number)!
    const created: Student = { ...spec, id: randomId(), classroomId, active: true }
    students.push(created)
    return created
  }
  for (const spec of specs) byNumber(spec.number)

  const offs = state.offDays.map((day) => day.date)
  const now = new Date().toISOString()
  const make = (partial: Omit<RequestRecord, 'periodDays' | 'classroomId' | 'createdAt' | 'updatedAt' | 'id'> & { id?: string }): RequestRecord => {
    const period = periodDays(partial.startDate, partial.endDate, offs)
    return {
      ...partial,
      id: partial.id ?? randomId(),
      classroomId,
      periodDays: Math.max(period, 1),
      createdAt: now,
      updatedAt: now,
    }
  }

  const haneul = byNumber(1)
  const junho = byNumber(2)
  const gildong = byNumber(5)
  const seoyeon = byNumber(8)
  const requests: RequestRecord[] = [
    make({
      studentId: gildong.id,
      docType: 'type1',
      category: 2,
      startDate: '2026-09-14',
      endDate: '2026-09-15',
      submittedOn: '2026-09-16',
      guardianName: gildong.motherName,
      guardianRelation: 'mother',
      fields: { reason: '급성 장염' },
      signaturePath: '',
      reportSubmittedOn: null,
      reportSignaturePath: null,
      status: 'submitted',
      rejectReason: null,
      reviewedAt: null,
      printedAt: null,
      reportPrintedAt: null,
    }),
    make({
      studentId: haneul.id,
      docType: 'type1',
      category: 1,
      startDate: '2026-09-16',
      endDate: '2026-09-16',
      submittedOn: '2026-09-17',
      guardianName: haneul.motherName,
      guardianRelation: 'mother',
      fields: { reason: '몸살' },
      signaturePath: '',
      reportSubmittedOn: null,
      reportSignaturePath: null,
      status: 'submitted',
      rejectReason: null,
      reviewedAt: null,
      printedAt: null,
      reportPrintedAt: null,
    }),
    make({
      studentId: junho.id,
      docType: 'type2',
      category: null,
      startDate: '2026-10-05',
      endDate: '2026-10-07',
      submittedOn: '2026-10-04',
      guardianName: junho.fatherName,
      guardianRelation: 'father',
      fields: { place: '국립중앙박물관', content: '역사 유적 조사', plan: '전시 해설을 듣고 관찰 기록을 작성한다.' },
      signaturePath: '',
      reportSubmittedOn: null,
      reportSignaturePath: null,
      status: 'submitted',
      rejectReason: null,
      reviewedAt: null,
      printedAt: null,
      reportPrintedAt: null,
    }),
    make({
      studentId: seoyeon.id,
      docType: 'type2',
      category: null,
      startDate: '2026-04-06',
      endDate: '2026-04-08',
      submittedOn: '2026-04-03',
      guardianName: seoyeon.motherName,
      guardianRelation: 'mother',
      fields: { place: '국립과천과학관', content: '과학관 체험', plan: '전시 노트를 작성한다.' },
      signaturePath: '',
      reportSubmittedOn: '2026-04-09',
      reportSignaturePath: '',
      status: 'reviewed',
      rejectReason: null,
      reviewedAt: now,
      printedAt: null,
      reportPrintedAt: null,
    }),
    make({
      studentId: seoyeon.id,
      docType: 'type2',
      category: null,
      startDate: '2026-05-11',
      endDate: '2026-05-15',
      submittedOn: '2026-05-08',
      guardianName: seoyeon.motherName,
      guardianRelation: 'mother',
      fields: { place: '전주 한옥마을', content: '전통 문화 체험', plan: '일정표를 따라 기록한다.' },
      signaturePath: '',
      reportSubmittedOn: '2026-05-18',
      reportSignaturePath: '',
      status: 'reviewed',
      rejectReason: null,
      reviewedAt: now,
      printedAt: null,
      reportPrintedAt: null,
    }),
  ]

  return { ...state, students, requests: [...state.requests, ...requests] }
}
