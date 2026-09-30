import { loadBuiltinHolidays, addSchoolOff, markPrinted, recalculateAffected, registerOrLogin, rejectRequest, removeSchoolOff, reviewRequest, saveSetup, updateRequest, upsertStudents, type RequestPatch, type StudentInput } from './actions.ts'
import { renderHwpx, type DocKind } from './hwpx/generate.ts'
import { present } from './present.ts'
import { printableItems, type PrintItem } from './printSort.ts'
import { seedSample } from './sample.ts'
import { periodDays } from './period.ts'
import { randomId } from './password.ts'
import { docLabel } from './labels.ts'
import { todayKST } from './dates.ts'
import { defaultSettings, emptyState, type DbState, type Settings, type Snapshot } from './types.ts'

export class LocalApp {
  state: DbState
  settings: Settings
  loggedIn = false

  constructor(state: DbState = emptyState(), settings: Settings = defaultSettings(), loggedIn = false) {
    this.state = state
    this.settings = settings
    this.loggedIn = loggedIn
  }

  snapshot(): Snapshot {
    const snap = present(this.state, this.settings)
    if (!this.loggedIn) snap.session = null
    return snap
  }

  async login(input: { email: string; password: string; name?: string; schoolName?: string }): Promise<Snapshot> {
    this.state = await registerOrLogin(this.state, input)
    this.loggedIn = true
    return this.snapshot()
  }

  logout(): Snapshot {
    this.loggedIn = false
    return this.snapshot()
  }

  saveSetup(input: { teacherName: string; schoolName: string; schoolYear: number; grade: number; classNo: number }): Snapshot {
    this.state = saveSetup(this.state, input)
    return this.snapshot()
  }

  saveStudents(rows: StudentInput[]) {
    const result = upsertStudents(this.state, rows)
    this.state = result.state
    return { snapshot: this.snapshot(), inserted: result.inserted, updated: result.updated, deactivated: result.deactivated }
  }

  loadHolidays(): Snapshot {
    this.state = loadBuiltinHolidays(this.state)
    return this.snapshot()
  }

  addOff(date: string, label: string): Snapshot {
    this.state = addSchoolOff(this.state, date, label)
    return this.snapshot()
  }

  removeOff(date: string): Snapshot {
    this.state = removeSchoolOff(this.state, date)
    return this.snapshot()
  }

  review(id: string): Snapshot {
    this.state = reviewRequest(this.state, id)
    return this.snapshot()
  }

  reject(id: string, reason: string): Snapshot {
    this.state = rejectRequest(this.state, id, reason)
    return this.snapshot()
  }

  update(id: string, patch: RequestPatch): Snapshot {
    this.state = updateRequest(this.state, id, patch)
    return this.snapshot()
  }

  recalculate(ids: string[]): Snapshot {
    this.state = recalculateAffected(this.state, ids)
    return this.snapshot()
  }

  markPrinted(requestId: string, kind: 'form' | 'report'): Snapshot {
    this.state = markPrinted(this.state, requestId, kind)
    return this.snapshot()
  }

  seed(): Snapshot {
    this.state = seedSample(this.state)
    return this.snapshot()
  }

  simulateIncoming(): { snapshot: Snapshot; requestId: string; title: string } {
    const classroom = this.state.classroom
    if (!classroom) throw new Error('학급을 먼저 등록해 주세요.')
    const student = this.state.students.find((item) => item.active)
    if (!student) throw new Error('학생 명부가 없습니다.')
    const start = todayKST()
    const days = periodDays(start, start, this.state.offDays.map((day) => day.date))
    const createdAt = new Date().toISOString()
    const request = {
      id: randomId(),
      studentId: student.id,
      classroomId: classroom.id,
      docType: 'type1' as const,
      category: 2,
      startDate: start,
      endDate: start,
      periodDays: Math.max(days, 1),
      submittedOn: start,
      guardianName: student.motherName || student.fatherName || '보호자',
      guardianRelation: 'mother' as const,
      fields: { reason: '발열' },
      signaturePath: '',
      reportSubmittedOn: null,
      reportSignaturePath: null,
      status: 'submitted' as const,
      rejectReason: null,
      reviewedAt: null,
      printedAt: null,
      reportPrintedAt: null,
      createdAt,
      updatedAt: createdAt,
    }
    this.state = { ...this.state, requests: [request, ...this.state.requests] }
    const title = `${classroom.grade}학년 ${classroom.classNo}반 ${student.number}번 ${student.name} — ${docLabel('type1', 2)} 제출`
    return { snapshot: this.snapshot(), requestId: request.id, title }
  }

  saveSettings(patch: Partial<Settings>): Snapshot {
    this.settings = { ...this.settings, ...patch }
    return this.snapshot()
  }

  printPlan(input: { requestIds?: string[]; unprintedOnly: boolean; includeIndex: boolean }): PrintItem[] {
    return printableItems(this.state.requests, this.state.students, input)
  }

  async render(input: { template: Uint8Array; kind: DocKind; requestId?: string }): Promise<Uint8Array> {
    if (!this.state.classroom) throw new Error('학급을 먼저 등록해 주세요.')
    const request = input.requestId ? this.state.requests.find((item) => item.id === input.requestId) : undefined
    const student = request ? this.state.students.find((item) => item.id === request.studentId) : undefined
    if (input.kind !== 'type2-3' && (!request || !student)) throw new Error('신청을 찾지 못했습니다.')
    return renderHwpx({
      template: input.template,
      kind: input.kind,
      request,
      student,
      classroom: this.state.classroom,
      requests: this.state.requests,
      students: this.state.students,
      settings: this.settings,
    })
  }
}
