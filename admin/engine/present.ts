import { todayKST } from './dates.ts'
import { periodDays } from './period.ts'
import { warningsFor } from './warnings.ts'
import type { Classroom, DbState, Gender, OffDay, RequestRecord, RequestView, Settings, Snapshot, Student } from './types.ts'
import { DB_PENDING_MESSAGE } from './types.ts'

export function offDates(state: DbState): string[] {
  return state.offDays.map((day) => day.date)
}

export function activeStudents(state: DbState): Student[] {
  return state.students.filter((student) => student.active).sort((a, b) => a.number - b.number)
}

export function requestViews(state: DbState): RequestView[] {
  const students = new Map(state.students.map((student) => [student.id, student]))
  const offs = offDates(state)
  return state.requests
    .map((request) => {
      const student = students.get(request.studentId)
      return {
        ...request,
        studentName: student?.name ?? '알 수 없음',
        studentNumber: student?.number ?? 0,
        gender: (student?.gender ?? '남') as Gender,
        warnings: warningsFor(request, student, state.requests, offs),
        reportMissing: request.docType === 'type2' && !request.reportSubmittedOn,
      }
    })
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export function present(state: DbState, settings: Settings): Snapshot {
  const teacher = state.teacher
  return {
    mode: 'local',
    db: { connected: false, message: DB_PENDING_MESSAGE },
    loadError: null,
    session: teacher ? { email: teacher.email, teacherName: teacher.name, schoolName: teacher.schoolName, mustChangePassword: false } : null,
    classroom: state.classroom,
    students: state.students.slice().sort((a, b) => a.number - b.number),
    offDays: state.offDays.slice().sort((a, b) => (a.date < b.date ? -1 : 1)),
    requests: requestViews(state),
    settings,
  }
}

export function recalculate(request: RequestRecord, offDays: string[]): RequestRecord {
  const days = periodDays(request.startDate, request.endDate, offDays)
  if (days < 1) throw new Error('수업일수가 0일입니다. 기간을 다시 확인해 주세요.')
  return { ...request, periodDays: days, updatedAt: new Date().toISOString() }
}

export function touch(request: RequestRecord, patch: Partial<RequestRecord>): RequestRecord {
  return { ...request, ...patch, updatedAt: new Date().toISOString() }
}

export function requireClassroom(state: DbState): Classroom {
  if (!state.classroom) throw new Error('학급을 먼저 등록해 주세요.')
  return state.classroom
}

export function findStudent(state: DbState, id: string): Student {
  const student = state.students.find((item) => item.id === id)
  if (!student) throw new Error('학생을 찾지 못했습니다.')
  return student
}

export function findRequest(state: DbState, id: string): RequestRecord {
  const request = state.requests.find((item) => item.id === id)
  if (!request) throw new Error('신청을 찾지 못했습니다.')
  return request
}

export function schoolYearOffDays(state: DbState, classroom: Classroom): OffDay[] {
  const start = `${classroom.schoolYear}-03-01`
  const end = `${classroom.schoolYear + 1}-02-28`
  return state.offDays.filter((day) => day.date >= start && day.date <= end)
}

export { todayKST }
