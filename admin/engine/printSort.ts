import type { RequestRecord, Student } from './types.ts'

export type PrintKind = 'type1' | 'type2-1' | 'type2-2' | 'type2-3'

export type PrintItem = {
  id: string
  requestId: string | null
  kind: PrintKind
  startDate: string
  studentNumber: number
  studentName: string
  docOrder: number
  createdAt: string
  label: string
}

function base(request: RequestRecord, student: Student, kind: PrintKind, docOrder: number, label: string): PrintItem {
  return {
    id: `${request.id}:${kind}`,
    requestId: request.id,
    kind,
    startDate: request.startDate,
    studentNumber: student.number,
    studentName: student.name,
    docOrder,
    createdAt: request.createdAt,
    label,
  }
}

export function printableItems(
  requests: RequestRecord[],
  students: Student[],
  options: { requestIds?: string[]; unprintedOnly: boolean; includeIndex: boolean },
): PrintItem[] {
  const byStudent = new Map(students.map((student) => [student.id, student]))
  const wanted = options.requestIds ? new Set(options.requestIds) : null
  const items: PrintItem[] = []

  for (const request of requests) {
    if (request.status === 'cancelled' || request.status === 'rejected') continue
    if (wanted && !wanted.has(request.id)) continue
    const student = byStudent.get(request.studentId)
    if (!student) continue
    if (request.docType === 'type1') {
      if (options.unprintedOnly && request.printedAt) continue
      items.push(base(request, student, 'type1', 0, '결석신고서'))
    } else {
      if (!options.unprintedOnly || !request.printedAt) {
        items.push(base(request, student, 'type2-1', 0, '체험학습 신청서'))
      }
      if (request.reportSubmittedOn && (!options.unprintedOnly || !request.reportPrintedAt)) {
        items.push(base(request, student, 'type2-2', 1, '체험학습 보고서'))
      }
    }
  }

  items.sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1
    if (a.studentNumber !== b.studentNumber) return a.studentNumber - b.studentNumber
    if (a.docOrder !== b.docOrder) return a.docOrder - b.docOrder
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
  })

  if (options.includeIndex) {
    items.push({
      id: 'index',
      requestId: null,
      kind: 'type2-3',
      startDate: '9999-99-99',
      studentNumber: 9999,
      studentName: '',
      docOrder: 2,
      createdAt: '',
      label: '색인 목록표',
    })
  }
  return items
}
