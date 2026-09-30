import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import type { RequestPatch, StudentInput } from '@engine/actions'
import { renderHwpx, type DocKind } from '@engine/hwpx/generate'
import { present } from '@engine/present'
import { printableItems, type PrintItem } from '@engine/printSort'
import {
  defaultSettings,
  emptyState,
  type Classroom,
  type DbState,
  type Gender,
  type OffDay,
  type OffDayKind,
  type Relation,
  type RequestRecord,
  type Settings,
  type Snapshot,
  type Status,
  type Student,
  type Teacher,
} from '@engine/types'

export type StoredSession = { access_token: string; refresh_token: string }

type DbError = { message: string; code?: string } | null

const CONNECTED = 'Supabase에 연결되어 있습니다. 학부모 제출이 이 학급으로 들어옵니다.'

/** 4자리 이하(기존 뒷자리 표시)는 번호를 바꾸지 않는다. */
export function phoneForUpsert(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 4) return null
  return value.trim()
}

export class RemoteApp {
  state: DbState
  settings: Settings
  loggedIn = false
  lastSeenAt: string | null
  loadError: string | null = null
  private client: SupabaseClient
  private email = ''
  private channel: RealtimeChannel | null = null
  private subscribedId: string | null = null
  private refreshing: Promise<void> | null = null
  private refreshAgain = false

  constructor(private opts: {
    url: string
    key: string
    settings: Settings
    lastSeenAt: string | null
    onNotify: (title: string, requestId: string) => void
    onSnapshot: () => void
    onPersist: () => void
    onSession: (session: StoredSession | null) => void
  }) {
    this.settings = { ...defaultSettings(), ...opts.settings }
    this.lastSeenAt = opts.lastSeenAt
    this.state = { ...emptyState(), lastSeenAt: opts.lastSeenAt }
    this.client = createClient(opts.url, opts.key, {
      auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
    })
    this.client.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      if (event === 'SIGNED_OUT') this.opts.onSession(null)
      else if (session) {
        this.opts.onSession({ access_token: session.access_token, refresh_token: session.refresh_token })
      }
    })
  }

  snapshot(): Snapshot {
    const snap = present(this.state, this.settings)
    return {
      ...snap,
      mode: 'remote',
      loadError: this.loadError,
      session: this.loggedIn
        ? {
          email: this.email,
          teacherName: this.state.teacher?.name || '',
          schoolName: this.state.teacher?.schoolName || '',
        }
        : null,
      db: { connected: true, message: this.loadError ?? CONNECTED },
    }
  }

  async restore(session: StoredSession | null): Promise<void> {
    if (!session?.access_token || !session.refresh_token) return
    const { data, error } = await this.client.auth.setSession(session)
    if (error || !data.session) {
      this.loggedIn = false
      this.opts.onSession(null)
      return
    }
    this.loggedIn = true
    this.email = data.session.user.email ?? ''
    await this.openDesk()
  }

  async login(input: { email: string; password: string }): Promise<Snapshot> {
    const email = input.email.trim().toLowerCase()
    if (!email || !input.password) throw new Error('이메일과 비밀번호를 입력해 주세요.')
    const { data, error } = await this.client.auth.signInWithPassword({ email, password: input.password })
    if (error || !data.session) throw new Error(loginMessage(error?.message ?? ''))
    this.loggedIn = true
    this.email = data.session.user.email ?? email
    await this.openDesk()
    return this.snapshot()
  }

  async logout(): Promise<Snapshot> {
    await this.channel?.unsubscribe()
    this.channel = null
    this.subscribedId = null
    await this.client.auth.signOut()
    this.loggedIn = false
    this.email = ''
    this.loadError = null
    this.state = { ...emptyState(), lastSeenAt: this.lastSeenAt }
    return this.snapshot()
  }

  async reload(): Promise<Snapshot> {
    if (!this.loggedIn) return this.snapshot()
    await this.openDesk()
    return this.snapshot()
  }

  async saveSetup(input: { teacherName: string; schoolName: string; schoolYear: number; grade: number; classNo: number }): Promise<Snapshot> {
    const user = await this.sessionUser()
    const teacherName = input.teacherName.trim()
    const schoolName = input.schoolName.trim()
    if (!teacherName || !schoolName) throw new Error('교사 이름과 학교 이름을 입력해 주세요.')
    if (input.grade < 1 || input.grade > 6 || input.classNo < 1) throw new Error('학년과 반을 확인해 주세요.')
    const { error: teacherError } = await this.client.from('teachers').upsert({
      id: user.id,
      name: teacherName,
      school_name: schoolName,
    })
    if (teacherError) {
      console.error(teacherError)
      throw new Error('교사 정보를 저장하지 못했습니다.')
    }
    const current = this.state.classroom
    if (current) {
      const { error } = await this.client.from('classrooms').update({
        school_year: input.schoolYear,
        grade: input.grade,
        class_no: input.classNo,
      }).eq('id', current.id)
      this.failUnique(error, '학급을 저장하지 못했습니다.', '같은 학년도·학년·반이 이미 있습니다.')
    } else {
      const { error } = await this.client.from('classrooms').insert({
        teacher_id: user.id,
        school_year: input.schoolYear,
        grade: input.grade,
        class_no: input.classNo,
      })
      this.failUnique(error, '학급을 저장하지 못했습니다.', '같은 학년도·학년·반이 이미 있습니다.')
    }
    await this.refresh()
    this.ensureSubscription()
    return this.snapshot()
  }

  async saveStudents(rows: StudentInput[]): Promise<{ snapshot: Snapshot; inserted: number; updated: number; deactivated: number }> {
    const classroom = this.state.classroom
    if (!classroom) throw new Error('학급을 먼저 등록해 주세요.')
    const result = await this.invoke<{ inserted: number; updated: number; deactivated: number }>('teacher-upsert-students', {
      classroomId: classroom.id,
      students: rows.map((row) => ({
        number: row.number,
        name: row.name,
        gender: row.gender,
        fatherName: row.fatherName.trim() || null,
        motherName: row.motherName.trim() || null,
        fatherPhone: phoneForUpsert(row.fatherPhone),
        motherPhone: phoneForUpsert(row.motherPhone),
      })),
    })
    await this.refresh()
    this.bumpSeen()
    return { snapshot: this.snapshot(), inserted: result.inserted, updated: result.updated, deactivated: result.deactivated }
  }

  async loadHolidays(): Promise<Snapshot> {
    if (!this.state.classroom) throw new Error('학급을 먼저 등록해 주세요.')
    await this.invoke('sync-holidays', { schoolYear: this.state.classroom.schoolYear })
    await this.refresh()
    return this.snapshot()
  }

  async addOff(date: string, label: string): Promise<Snapshot> {
    const { error } = await this.client.from('off_days').insert({
      date,
      kind: 'school_off',
      label: label.trim() || '재량휴업일',
    })
    this.failUnique(error, '재량휴업일을 넣지 못했습니다.', '그 날짜는 이미 휴업일입니다.')
    await this.refresh()
    return this.snapshot()
  }

  async removeOff(date: string): Promise<Snapshot> {
    const { data, error } = await this.client.from('off_days').delete().eq('date', date).eq('kind', 'school_off').select('date')
    if (error) {
      console.error(error)
      throw new Error('재량휴업일을 지우지 못했습니다.')
    }
    if (!data?.length) throw new Error('재량휴업일만 지울 수 있습니다.')
    await this.refresh()
    return this.snapshot()
  }

  async review(id: string): Promise<Snapshot> {
    const { data, error } = await this.client.from('requests').update({
      status: 'reviewed',
      reviewed_at: new Date().toISOString(),
    }).eq('id', id).eq('status', 'submitted').select('id')
    if (error) {
      console.error(error)
      throw new Error('확인으로 바꾸지 못했습니다.')
    }
    if (!data?.length) throw new Error('제출된 신청만 확인할 수 있습니다.')
    await this.refresh()
    this.bumpSeen()
    return this.snapshot()
  }

  async reject(id: string, reason: string): Promise<Snapshot> {
    const rejectReason = reason.trim()
    if (!rejectReason) throw new Error('반려 사유를 입력해 주세요.')
    const { data, error } = await this.client.from('requests').update({
      status: 'rejected',
      reject_reason: rejectReason,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id).eq('status', 'submitted').select('id')
    if (error) {
      console.error(error)
      throw new Error('반려하지 못했습니다. 제출된 신청만 반려할 수 있습니다.')
    }
    if (!data?.length) throw new Error('제출된 신청만 반려할 수 있습니다.')
    await this.refresh()
    this.bumpSeen()
    return this.snapshot()
  }

  async update(id: string, patch: RequestPatch): Promise<Snapshot> {
    await this.invoke('teacher-update-request', {
      requestId: id,
      startDate: patch.startDate,
      endDate: patch.endDate,
      category: patch.category,
      fields: patch.fields,
      guardianName: patch.guardianName,
    })
    await this.refresh()
    this.bumpSeen()
    return this.snapshot()
  }

  async recalculate(ids: string[]): Promise<Snapshot> {
    for (const id of ids) {
      const request = this.state.requests.find((row) => row.id === id)
      if (!request) continue
      await this.invoke('teacher-update-request', {
        requestId: id,
        startDate: request.startDate,
        endDate: request.endDate,
      })
    }
    await this.refresh()
    this.bumpSeen()
    return this.snapshot()
  }

  async markPrinted(requestId: string, kind: 'form' | 'report'): Promise<Snapshot> {
    const request = this.state.requests.find((row) => row.id === requestId)
    if (!request || request.status === 'cancelled' || request.status === 'rejected') {
      throw new Error('취소·반려된 건은 출력됨으로 표시하지 않습니다.')
    }
    const column = kind === 'report' ? 'report_printed_at' : 'printed_at'
    const { error } = await this.client.from('requests').update({ [column]: new Date().toISOString() }).eq('id', requestId)
    if (error) {
      console.error(error)
      throw new Error('출력 시각을 기록하지 못했습니다.')
    }
    await this.refresh()
    this.bumpSeen()
    return this.snapshot()
  }

  seed(): Snapshot {
    throw new Error('서버에 연결된 상태에서는 샘플을 넣지 않습니다.')
  }

  simulateIncoming(): { snapshot: Snapshot; requestId: string; title: string } {
    throw new Error('서버에 연결된 상태에서는 알림 시험을 하지 않습니다.')
  }

  saveSettings(patch: Partial<Settings>): Snapshot {
    this.settings = { ...this.settings, ...patch }
    this.opts.onPersist()
    return this.snapshot()
  }

  printPlan(input: { requestIds?: string[]; unprintedOnly: boolean; includeIndex: boolean }): PrintItem[] {
    return printableItems(this.state.requests, this.state.students, input)
  }

  async reportEvidenceUrls(requestId: string): Promise<Array<{ path: string; url: string }>> {
    const request = this.state.requests.find((item) => item.id === requestId)
    const paths = request?.reportEvidencePaths ?? []
    if (!paths.length) return []
    const { data, error } = await this.client.storage.from('report-evidence').createSignedUrls(paths, 3600)
    if (error) {
      console.error(error)
      throw new Error('보고서 증빙 사진을 불러오지 못했습니다.')
    }
    return (data ?? []).flatMap((item) => item.path && item.signedUrl ? [{ path: item.path, url: item.signedUrl }] : [])
  }

  async render(input: { template: Uint8Array; kind: DocKind; requestId?: string }): Promise<Uint8Array> {
    if (!this.state.classroom) throw new Error('학급을 먼저 등록해 주세요.')
    const request = input.requestId ? this.state.requests.find((item) => item.id === input.requestId) : undefined
    const student = request ? this.state.students.find((item) => item.id === request.studentId) : undefined
    if (input.kind !== 'type2-3' && (!request || !student)) throw new Error('신청을 찾지 못했습니다.')
    const parentSignature = request
      ? await this.signatureBytes(input.kind === 'type2-2' ? request.reportSignaturePath : request.signaturePath)
      : null
    const reportEvidence = request && input.kind === 'type2-2'
      ? await this.reportEvidenceBytes(request.reportEvidencePaths ?? [])
      : []
    return renderHwpx({
      template: input.template,
      kind: input.kind,
      request,
      student,
      classroom: this.state.classroom,
      requests: this.state.requests,
      students: this.state.students,
      settings: this.settings,
      parentSignature,
      reportEvidence,
    })
  }

  private async openDesk(): Promise<void> {
    this.loadError = null
    try {
      await this.refresh()
      await this.catchUp()
      this.ensureSubscription()
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.'
    }
  }

  private async refresh(): Promise<void> {
    if (this.refreshing) {
      this.refreshAgain = true
      await this.refreshing
      return
    }
    this.refreshing = (async () => {
      do {
        this.refreshAgain = false
        await this.load()
      } while (this.refreshAgain)
    })().finally(() => {
      this.refreshing = null
    })
    await this.refreshing
  }

  private async load(): Promise<void> {
    const user = await this.sessionUser()
    const [teacherRes, roomRes, offRes] = await Promise.all([
      this.client.from('teachers').select('id, name, school_name').eq('id', user.id).maybeSingle(),
      this.client.from('classrooms').select('id, teacher_id, school_year, grade, class_no').eq('teacher_id', user.id).order('school_year', { ascending: false }),
      this.client.from('off_days').select('date, kind, label').order('date'),
    ])
    this.fail(teacherRes.error, '교사 정보를 불러오지 못했습니다.')
    this.fail(roomRes.error, '학급을 불러오지 못했습니다.')
    this.fail(offRes.error, '휴업일을 불러오지 못했습니다.')
    const room = ((roomRes.data ?? []) as ClassroomRow[])[0] ?? null
    let students: Student[] = []
    let requests: RequestRecord[] = []
    if (room) {
      const [studentRes, requestRes] = await Promise.all([
        this.client.from('students').select('id, classroom_id, number, name, gender, father_name, mother_name, father_phone_last4, mother_phone_last4, active').eq('classroom_id', room.id).order('number'),
        this.client.from('requests').select('id, student_id, classroom_id, doc_type, category, start_date, end_date, period_days, submitted_on, guardian_name, guardian_relation, fields, signature_path, report_submitted_on, report_signature_path, report_content, report_evidence_paths, status, reject_reason, reviewed_at, printed_at, report_printed_at, created_at, updated_at').eq('classroom_id', room.id).order('updated_at', { ascending: false }),
      ])
      this.fail(studentRes.error, '명부를 불러오지 못했습니다.')
      this.fail(requestRes.error, '신청을 불러오지 못했습니다.')
      students = ((studentRes.data ?? []) as StudentRow[]).map(mapStudent)
      requests = ((requestRes.data ?? []) as RequestRow[]).map(mapRequest)
    }
    const teacherRow = teacherRes.data as { id: string; name: string; school_name: string } | null
    const teacher: Teacher | null = teacherRow
      ? {
        id: teacherRow.id,
        email: this.email,
        name: teacherRow.name,
        schoolName: teacherRow.school_name,
        passwordHash: '',
        passwordSalt: '',
      }
      : null
    const classroom: Classroom | null = room
      ? { id: room.id, teacherId: room.teacher_id, schoolYear: room.school_year, grade: room.grade, classNo: room.class_no }
      : null
    this.state = {
      teacher,
      classroom,
      students,
      offDays: ((offRes.data ?? []) as OffRow[]).map(mapOff),
      requests,
      lastSeenAt: this.lastSeenAt,
    }
  }

  private async sessionUser(): Promise<{ id: string }> {
    const { data, error } = await this.client.auth.getSession()
    if (error || !data.session) throw new Error('다시 로그인해 주세요.')
    this.email = data.session.user.email ?? this.email
    return { id: data.session.user.id }
  }

  private async catchUp(): Promise<void> {
    const since = this.lastSeenAt
    if (!since) {
      this.bumpSeen()
      return
    }
    const missed = this.state.requests.filter((row) => row.updatedAt > since)
    for (const row of missed) {
      const student = this.state.students.find((item) => item.id === row.studentId)
      const name = student?.name ?? '학생'
      const title = row.status === 'cancelled'
        ? `${name} 신청을 취소했습니다`
        : `${name} 신청이 바뀌었습니다. 대장을 확인해 주세요.`
      this.opts.onNotify(title, row.id)
    }
    this.bumpSeen()
  }

  private bumpSeen(): void {
    const newest = this.state.requests.reduce((max, row) => (row.updatedAt > max ? row.updatedAt : max), this.lastSeenAt ?? '')
    this.lastSeenAt = newest || new Date().toISOString()
    this.state = { ...this.state, lastSeenAt: this.lastSeenAt }
    this.opts.onPersist()
  }

  private ensureSubscription(): void {
    const id = this.state.classroom?.id ?? null
    if (id === this.subscribedId) return
    void this.channel?.unsubscribe()
    this.channel = null
    this.subscribedId = id
    if (!id) return
    this.channel = this.client
      .channel(`class-requests-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'requests',
        filter: `classroom_id=eq.${id}`,
      }, (payload) => {
        void this.onRemoteChange(payload as unknown as LivePayload)
      })
      .subscribe()
  }

  private async onRemoteChange(payload: LivePayload): Promise<void> {
    const id = String(payload.new.id ?? '')
    const before = this.state.requests.find((row) => row.id === id) ?? null
    await this.refresh()
    this.opts.onSnapshot()
    const title = this.liveTitle(payload, before)
    if (title && id) this.opts.onNotify(title, id)
    this.bumpSeen()
  }

  /** RLS가 켜진 테이블은 Realtime의 old에 기본키만 오므로, 비교 기준은 갱신 전 로컬 행이다. */
  private liveTitle(payload: LivePayload, before: RequestRecord | null): string | null {
    const next = payload.new
    const name = this.studentName(String(next.student_id ?? ''))
    if (payload.eventType === 'INSERT') {
      return `${name} ${next.doc_type === 'type2' ? '체험학습' : '결석'} 신청이 들어왔습니다`
    }
    if (payload.eventType !== 'UPDATE' || !before) return null
    if (!before.reportSubmittedOn && next.report_submitted_on) {
      return `${name} 보고서가 도착했습니다`
    }
    if (before.status !== 'cancelled' && next.status === 'cancelled') {
      return `${name} 신청을 취소했습니다`
    }
    return null
  }

  private studentName(studentId: string): string {
    return this.state.students.find((student) => student.id === studentId)?.name ?? '학생'
  }

  private async reportEvidenceBytes(paths: string[]): Promise<Uint8Array[]> {
    return Promise.all(paths.map(async (path) => {
      const { data, error } = await this.client.storage.from('report-evidence').download(path)
      if (error || !data) {
        console.error(error)
        throw new Error('보고서 증빙 사진을 불러오지 못했습니다.')
      }
      return new Uint8Array(await data.arrayBuffer())
    }))
  }

  private async signatureBytes(storagePath: string | null): Promise<Uint8Array | null> {
    if (!storagePath) return null
    const key = storagePath.startsWith('signatures/') ? storagePath.slice('signatures/'.length) : storagePath
    const { data, error } = await this.client.storage.from('signatures').download(key)
    if (error || !data) throw new Error('학부모 서명을 불러오지 못했습니다.')
    return new Uint8Array(await data.arrayBuffer())
  }

  private async invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client.functions.invoke(name, { body })
    if (error) throw new Error(await functionMessage(error))
    return data as T
  }

  private fail(error: DbError, fallback: string): void {
    if (!error) return
    console.error(error)
    throw new Error(fallback)
  }

  private failUnique(error: DbError, fallback: string, duplicate: string): void {
    if (!error) return
    console.error(error)
    throw new Error(error.code === '23505' ? duplicate : fallback)
  }
}

type ClassroomRow = { id: string; teacher_id: string; school_year: number; grade: number; class_no: number }
type StudentRow = {
  id: string
  classroom_id: string
  number: number
  name: string
  gender: string
  father_name: string | null
  mother_name: string | null
  father_phone_last4: string | null
  mother_phone_last4: string | null
  active: boolean
}
type RequestRow = {
  id: string
  student_id: string
  classroom_id: string
  doc_type: 'type1' | 'type2'
  category: number | null
  start_date: string
  end_date: string
  period_days: number
  submitted_on: string
  guardian_name: string
  guardian_relation: Relation
  fields: RequestRecord['fields']
  signature_path: string
  report_submitted_on: string | null
  report_signature_path: string | null
  report_content: string | null
  report_evidence_paths: string[] | null
  status: Status
  reject_reason: string | null
  reviewed_at: string | null
  printed_at: string | null
  report_printed_at: string | null
  created_at: string
  updated_at: string
}
type OffRow = { date: string; kind: OffDayKind; label: string }
type LivePayload = { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }

function mapStudent(row: StudentRow): Student {
  return {
    id: row.id,
    classroomId: row.classroom_id,
    number: row.number,
    name: row.name,
    gender: (row.gender === '여' ? '여' : '남') as Gender,
    fatherName: row.father_name ?? '',
    motherName: row.mother_name ?? '',
    fatherPhoneLast4: row.father_phone_last4 ?? '',
    motherPhoneLast4: row.mother_phone_last4 ?? '',
    active: row.active,
  }
}

function mapRequest(row: RequestRow): RequestRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    classroomId: row.classroom_id,
    docType: row.doc_type,
    category: row.category,
    startDate: row.start_date,
    endDate: row.end_date,
    periodDays: row.period_days,
    submittedOn: row.submitted_on,
    guardianName: row.guardian_name,
    guardianRelation: row.guardian_relation,
    fields: row.fields ?? {},
    signaturePath: row.signature_path,
    reportSubmittedOn: row.report_submitted_on,
    reportSignaturePath: row.report_signature_path,
    reportContent: row.report_content ?? "",
    reportEvidencePaths: row.report_evidence_paths ?? [],
    status: row.status,
    rejectReason: row.reject_reason,
    reviewedAt: row.reviewed_at,
    printedAt: row.printed_at,
    reportPrintedAt: row.report_printed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapOff(row: OffRow): OffDay {
  return { date: row.date, kind: row.kind, label: row.label }
}

function loginMessage(raw: string): string {
  const text = raw.toLowerCase()
  if (text.includes('invalid login')) return '이메일 또는 비밀번호가 맞지 않습니다.'
  if (text.includes('email not confirmed')) return '이메일 인증이 끝나지 않았습니다.'
  return '로그인하지 못했습니다. 초대된 계정인지 확인해 주세요.'
}

async function functionMessage(error: { message?: string; context?: Response }): Promise<string> {
  const context = error.context
  if (context && typeof context.json === 'function') {
    try {
      const payload = await context.json() as { error?: { message?: string } }
      if (payload?.error?.message) return payload.error.message
    } catch {
      /* 응답 본문을 이미 읽은 경우 */
    }
  }
  return '서버 함수를 실행하지 못했습니다.'
}
