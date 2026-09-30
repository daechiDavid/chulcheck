import { hashPassword, randomId } from './password.ts'
import { BUILTIN_HOLIDAYS } from './holidays.ts'
import { periodDays } from './period.ts'
import { findRequest, offDates, recalculate, requireClassroom } from './present.ts'
import type { DbState, Gender, RequestRecord, Student, Teacher } from './types.ts'

export type StudentInput = {
  number: number
  name: string
  gender: Gender
  fatherName: string
  motherName: string
  fatherPhone: string
  motherPhone: string
}

function last4(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.slice(-4)
}

function nowIso(): string {
  return new Date().toISOString()
}

export async function registerOrLogin(
  state: DbState,
  input: { email: string; password: string; name?: string; schoolName?: string },
): Promise<DbState> {
  const email = input.email.trim().toLowerCase()
  if (!email || !input.password) throw new Error('이메일과 비밀번호를 입력해 주세요.')
  if (!state.teacher) {
    const salt = randomId()
    const teacher: Teacher = {
      id: randomId(),
      email,
      name: input.name?.trim() || '담임',
      schoolName: input.schoolName?.trim() || '',
      passwordSalt: salt,
      passwordHash: await hashPassword(input.password, salt),
    }
    return { ...state, teacher }
  }
  if (state.teacher.email !== email) throw new Error('이 PC에 저장된 교사 계정과 이메일이 다릅니다.')
  const hash = await hashPassword(input.password, state.teacher.passwordSalt)
  if (hash !== state.teacher.passwordHash) throw new Error('비밀번호가 맞지 않습니다.')
  return state
}

export function saveSetup(
  state: DbState,
  input: { teacherName: string; schoolName: string; schoolYear: number; grade: number; classNo: number },
): DbState {
  if (!state.teacher) throw new Error('먼저 로그인해 주세요.')
  if (!input.teacherName.trim() || !input.schoolName.trim()) throw new Error('교사 이름과 학교 이름을 입력해 주세요.')
  if (input.grade < 1 || input.grade > 6 || input.classNo < 1) throw new Error('학년과 반을 확인해 주세요.')
  const teacher = { ...state.teacher, name: input.teacherName.trim(), schoolName: input.schoolName.trim() }
  const classroom = state.classroom ?? {
    id: randomId(),
    teacherId: teacher.id,
    schoolYear: input.schoolYear,
    grade: input.grade,
    classNo: input.classNo,
  }
  return {
    ...state,
    teacher,
    classroom: { ...classroom, schoolYear: input.schoolYear, grade: input.grade, classNo: input.classNo },
  }
}

export function upsertStudents(state: DbState, rows: StudentInput[]): { state: DbState; inserted: number; updated: number; deactivated: number } {
  const classroom = requireClassroom(state)
  const seen = new Set<number>()
  let inserted = 0
  let updated = 0
  const next: Student[] = []
  for (const row of rows) {
    if (!Number.isInteger(row.number) || row.number < 1) throw new Error('번호는 1 이상의 정수여야 합니다.')
    if (seen.has(row.number)) throw new Error(`${row.number}번이 중복되었습니다.`)
    seen.add(row.number)
    if (!row.name.trim()) throw new Error(`${row.number}번 이름이 비어 있습니다.`)
    if (row.gender !== '남' && row.gender !== '여') throw new Error(`${row.number}번 성별은 남 또는 여입니다.`)
    const prev = state.students.find((student) => student.number === row.number && student.classroomId === classroom.id)
    if (prev) {
      updated += 1
      next.push({
        ...prev,
        name: row.name.trim(),
        gender: row.gender,
        fatherName: row.fatherName.trim(),
        motherName: row.motherName.trim(),
        fatherPhoneLast4: row.fatherPhone ? last4(row.fatherPhone) : prev.fatherPhoneLast4,
        motherPhoneLast4: row.motherPhone ? last4(row.motherPhone) : prev.motherPhoneLast4,
        active: true,
      })
    } else {
      inserted += 1
      next.push({
        id: randomId(),
        classroomId: classroom.id,
        number: row.number,
        name: row.name.trim(),
        gender: row.gender,
        fatherName: row.fatherName.trim(),
        motherName: row.motherName.trim(),
        fatherPhoneLast4: last4(row.fatherPhone),
        motherPhoneLast4: last4(row.motherPhone),
        active: true,
      })
    }
  }
  let deactivated = 0
  for (const student of state.students) {
    if (student.classroomId !== classroom.id || seen.has(student.number)) continue
    deactivated += 1
    next.push({ ...student, active: false })
  }
  return { state: { ...state, students: next }, inserted, updated, deactivated }
}

export function loadBuiltinHolidays(state: DbState): DbState {
  const map = new Map(state.offDays.map((day) => [day.date, day]))
  for (const holiday of BUILTIN_HOLIDAYS) {
    const current = map.get(holiday.date)
    if (!current || current.kind === 'holiday') map.set(holiday.date, holiday)
  }
  return { ...state, offDays: [...map.values()] }
}

export function addSchoolOff(state: DbState, date: string, label: string): DbState {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('날짜 형식이 아닙니다.')
  const rest = state.offDays.filter((day) => day.date !== date)
  return { ...state, offDays: [...rest, { date, kind: 'school_off', label: label.trim() || '재량휴업일' }] }
}

export function removeSchoolOff(state: DbState, date: string): DbState {
  const target = state.offDays.find((day) => day.date === date)
  if (!target) return state
  if (target.kind === 'holiday') throw new Error('공휴일은 목록에서 지우지 않습니다. 재량휴업일만 삭제할 수 있습니다.')
  return { ...state, offDays: state.offDays.filter((day) => day.date !== date) }
}

export function affectedByOffDay(state: DbState, date: string): RequestRecord[] {
  return state.requests.filter(
    (request) =>
      request.status !== 'cancelled' &&
      request.status !== 'rejected' &&
      request.startDate <= date &&
      request.endDate >= date,
  )
}

export function reviewRequest(state: DbState, id: string): DbState {
  const request = findRequest(state, id)
  if (request.status !== 'submitted') throw new Error('제출됨 상태만 확인할 수 있습니다.')
  const reviewedAt = nowIso()
  return replaceRequest(state, { ...request, status: 'reviewed', reviewedAt, rejectReason: null, updatedAt: reviewedAt })
}

export function rejectRequest(state: DbState, id: string, reason: string): DbState {
  const request = findRequest(state, id)
  if (request.status !== 'submitted') throw new Error('제출됨 상태만 반려할 수 있습니다.')
  if (!reason.trim()) throw new Error('반려 사유를 입력해 주세요.')
  const reviewedAt = nowIso()
  return replaceRequest(state, {
    ...request,
    status: 'rejected',
    rejectReason: reason.trim(),
    reviewedAt,
    updatedAt: reviewedAt,
  })
}

export type RequestPatch = {
  startDate?: string
  endDate?: string
  category?: number | null
  fields?: RequestRecord['fields']
  guardianName?: string
}

export function updateRequest(state: DbState, id: string, patch: RequestPatch): DbState {
  const request = findRequest(state, id)
  if (request.status === 'cancelled' || request.status === 'rejected') {
    throw new Error('취소·반려된 신청은 수정할 수 없습니다.')
  }
  const next: RequestRecord = {
    ...request,
    startDate: patch.startDate ?? request.startDate,
    endDate: patch.endDate ?? request.endDate,
    category: patch.category === undefined ? request.category : patch.category,
    fields: patch.fields ? { ...request.fields, ...patch.fields } : request.fields,
    guardianName: patch.guardianName?.trim() || request.guardianName,
  }
  if (next.endDate < next.startDate) throw new Error('종료일이 시작일보다 빠릅니다.')
  return replaceRequest(state, recalculate(next, offDates(state)))
}

export function recalculateAffected(state: DbState, ids: string[]): DbState {
  let next = state
  for (const id of ids) {
    const request = findRequest(next, id)
    next = replaceRequest(next, recalculate(request, offDates(next)))
  }
  return next
}

export function markPrinted(state: DbState, requestId: string, kind: 'form' | 'report'): DbState {
  const request = findRequest(state, requestId)
  const stamp = nowIso()
  if (kind === 'report') return replaceRequest(state, { ...request, reportPrintedAt: stamp, updatedAt: stamp })
  return replaceRequest(state, { ...request, printedAt: stamp, updatedAt: stamp })
}

export function replaceRequest(state: DbState, request: RequestRecord): DbState {
  return { ...state, requests: state.requests.map((item) => (item.id === request.id ? request : item)) }
}

export function periodPreview(start: string, end: string, state: DbState): number {
  return periodDays(start, end, offDates(state))
}
