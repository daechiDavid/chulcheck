export type DocType = 'type1' | 'type2'
export type Status = 'submitted' | 'reviewed' | 'rejected' | 'cancelled'
export type Relation = 'father' | 'mother'
export type Gender = '남' | '여'
export type OffDayKind = 'holiday' | 'school_off'
export type Evidence = 'r1' | 'r2' | 'r3'

export type Teacher = {
  id: string
  email: string
  name: string
  schoolName: string
  passwordHash: string
  passwordSalt: string
}

export type Classroom = {
  id: string
  teacherId: string
  schoolYear: number
  grade: number
  classNo: number
}

export type Student = {
  id: string
  classroomId: string
  number: number
  name: string
  gender: Gender
  fatherName: string
  motherName: string
  fatherPhoneLast4: string
  motherPhoneLast4: string
  active: boolean
}

export type OffDay = {
  date: string
  kind: OffDayKind
  label: string
}

export type Type1Fields = {
  reason?: string
  date4?: string
  evidence?: Evidence[]
}

export type Type2Fields = {
  place?: string
  content?: string
  plan?: string
}

export type RequestRecord = {
  id: string
  studentId: string
  classroomId: string
  docType: DocType
  category: number | null
  startDate: string
  endDate: string
  periodDays: number
  submittedOn: string
  guardianName: string
  guardianRelation: Relation
  fields: Type1Fields & Type2Fields
  signaturePath: string
  reportSubmittedOn: string | null
  reportSignaturePath: string | null
  reportContent?: string
  reportEvidencePaths?: string[]
  status: Status
  rejectReason: string | null
  reviewedAt: string | null
  printedAt: string | null
  reportPrintedAt: string | null
  createdAt: string
  updatedAt: string
}

export type SignatureSlot = 'sign' | 'stamp'

export type Settings = {
  outputDir: string
  printer: string
  neisAutoMark: boolean
  openAtLogin: boolean
  defaultSignature: SignatureSlot
  signDataUrl: string
  stampDataUrl: string
}

export type DbState = {
  teacher: Teacher | null
  classroom: Classroom | null
  students: Student[]
  offDays: OffDay[]
  requests: RequestRecord[]
  lastSeenAt: string | null
}

export type Warning = { code: string; message: string }

export type RequestView = RequestRecord & {
  studentName: string
  studentNumber: number
  gender: Gender
  warnings: Warning[]
  reportMissing: boolean
}

export type Snapshot = {
  mode: 'local' | 'remote'
  db: { connected: boolean; message: string }
  loadError: string | null
  session: { email: string; teacherName: string; schoolName: string } | null
  classroom: Classroom | null
  students: Student[]
  offDays: OffDay[]
  requests: RequestView[]
  settings: Settings
}

export const DB_PENDING_MESSAGE =
  'Supabase 연결 대기. web 담당자가 스키마를 준비하면 URL·publishable key만 받아 붙입니다. 지금은 이 PC의 로컬 데이터로 동작합니다.'

export function emptyState(): DbState {
  return {
    teacher: null,
    classroom: null,
    students: [],
    offDays: [],
    requests: [],
    lastSeenAt: null,
  }
}

export function defaultSettings(): Settings {
  return {
    outputDir: '',
    printer: '',
    neisAutoMark: false,
    openAtLogin: false,
    defaultSignature: 'sign',
    signDataUrl: '',
    stampDataUrl: '',
  }
}
