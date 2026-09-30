import { compareYmd, formatDotDate, schoolYearOf, unpadded } from './dates.ts'
import type { Classroom, RequestRecord, Student } from './types.ts'

export type PlaceholderMap = Record<string, string>

function box(selected: boolean): string {
  return selected ? '■' : '□'
}

function reason(request: RequestRecord, category: number): string {
  if (request.docType !== 'type1' || request.category !== category) return ''
  return request.fields.reason ?? ''
}

export function type1Values(
  request: RequestRecord,
  student: Student,
  classroom: Classroom,
): PlaceholderMap {
  const start = unpadded(request.startDate)
  const end = unpadded(request.endDate)
  const submitted = unpadded(request.submittedOn)
  const category = request.category ?? 0
  const evidence = new Set(request.fields.evidence ?? [])
  const values: PlaceholderMap = {
    grade: String(classroom.grade),
    class: String(classroom.classNo),
    번호: String(student.number),
    학생명: student.name,
    sY: start.y,
    sM: start.m,
    sd: start.d,
    eY: end.y,
    eM: end.m,
    eD: end.d,
    period: String(request.periodDays),
    yyyy: submitted.y,
    M: submitted.m,
    d: submitted.d,
    name: request.guardianName,
    '4-date': request.category === 4 && request.fields.date4 ? formatDotDate(request.fields.date4) : '',
  }
  for (let n = 1; n <= 7; n += 1) {
    values[String(n)] = box(category === n)
    values[`${n}-reason`] = reason(request, n)
  }
  values['6-r1'] = category === 6 && evidence.has('r1') ? '○' : ''
  values['6-r2'] = category === 6 && evidence.has('r2') ? '○' : ''
  values['6-r3'] = category === 6 && evidence.has('r3') ? '○' : ''
  return values
}

function tripValues(
  request: RequestRecord,
  student: Student,
  classroom: Classroom,
  submittedOn: string,
): PlaceholderMap {
  const start = unpadded(request.startDate)
  const end = unpadded(request.endDate)
  const submitted = unpadded(submittedOn)
  return {
    grade: String(classroom.grade),
    class: String(classroom.classNo),
    sName: student.name,
    gender: student.gender,
    sY: start.y,
    sM: start.m,
    sd: start.d,
    eY: end.y,
    eM: end.m,
    ed: end.d,
    period: String(request.periodDays),
    place: request.fields.place ?? '',
    reason: request.fields.content ?? '',
    plan: request.fields.plan ?? '',
    yyyy: submitted.y,
    M: submitted.m,
    d: submitted.d,
    aName: request.guardianName,
  }
}

export function type2ApplicationValues(
  request: RequestRecord,
  student: Student,
  classroom: Classroom,
): PlaceholderMap {
  return tripValues(request, student, classroom, request.submittedOn)
}

export function type2ReportValues(
  request: RequestRecord,
  student: Student,
  classroom: Classroom,
): PlaceholderMap {
  if (!request.reportSubmittedOn) {
    throw new Error('보고서 제출일이 없습니다.')
  }
  return { ...tripValues(request, student, classroom, request.reportSubmittedOn), reason: request.reportContent ?? "" }
}

export function formatRange(start: string, end: string, days: number): string {
  const yy = start.slice(2, 4)
  const sMM = start.slice(5, 7)
  const sdd = start.slice(8, 10)
  const eyy = end.slice(2, 4)
  const eMM = end.slice(5, 7)
  const edd = end.slice(8, 10)
  const endPart = yy === eyy ? `${eMM}.${edd}` : `${eyy}.${eMM}.${edd}`
  return `${yy}.${sMM}.${sdd}. ~ ${endPart}(${days}일)`
}

export type IndexSource = {
  request: RequestRecord
  student: Student
}

export type IndexRow = {
  no: number
  studentId: string
  studentName: string
  studentNumber: number
  range: string
  place: string
  periodDays: number
  addpr: number
  rptMark: string
  neisMark: string
  overCumulative: boolean
  startDate: string
}

export function indexRows(sources: IndexSource[], neisAutoMark: boolean): IndexRow[] {
  const usable = sources.filter(
    ({ request }) => request.docType === 'type2' && request.status !== 'rejected' && request.status !== 'cancelled',
  )
  usable.sort((a, b) => {
    const byDate = compareYmd(a.request.startDate, b.request.startDate)
    if (byDate) return byDate
    if (a.student.number !== b.student.number) return a.student.number - b.student.number
    return a.request.createdAt < b.request.createdAt ? -1 : a.request.createdAt > b.request.createdAt ? 1 : 0
  })
  const sums = new Map<string, number>()
  return usable.map((item, index) => {
    const yearKey = `${item.request.studentId}:${schoolYearOf(item.request.startDate)}`
    const addpr = (sums.get(yearKey) ?? 0) + item.request.periodDays
    sums.set(yearKey, addpr)
    return {
      no: index + 1,
      studentId: item.request.studentId,
      studentName: item.student.name,
      studentNumber: item.student.number,
      range: formatRange(item.request.startDate, item.request.endDate, item.request.periodDays),
      place: item.request.fields.place ?? '',
      periodDays: item.request.periodDays,
      addpr,
      rptMark: item.request.reportSubmittedOn ? '○' : '',
      neisMark: neisAutoMark ? '○' : '',
      overCumulative: addpr > 19,
      startDate: item.request.startDate,
    }
  })
}

export function indexHeaderValues(classroom: Classroom): PlaceholderMap {
  return {
    schoolYear: String(classroom.schoolYear),
    grade: String(classroom.grade),
    class: String(classroom.classNo),
  }
}

export const TYPE1_KEYS = [
  'grade', 'class', '번호', '학생명', 'sY', 'sM', 'sd', 'eY', 'eM', 'eD', 'period',
  '1', '2', '3', '4', '5', '6', '7',
  '1-reason', '2-reason', '3-reason', '4-date', '4-reason', '5-reason', '6-reason', '6-r1', '6-r2', '6-r3', '7-reason',
  'yyyy', 'M', 'd', 'name',
]

export const TYPE2_APP_KEYS = [
  'grade', 'class', 'sName', 'gender', 'sY', 'sM', 'sd', 'eY', 'eM', 'ed', 'period',
  'place', 'reason', 'plan', 'yyyy', 'M', 'd', 'aName',
]

export const TYPE2_REPORT_KEYS = [
  'grade', 'class', 'sName', 'gender', 'sY', 'sM', 'sd', 'eY', 'eM', 'ed', 'period', 'reason', 'yyyy', 'M', 'd', 'aName',
]

export const TYPE2_INDEX_HEADER_KEYS = ['schoolYear', 'grade', 'class']
export const TYPE2_INDEX_ROW_KEYS = ['no', 'sName', 'range', 'place', 'rptMark', 'neisMark', 'addpr']
