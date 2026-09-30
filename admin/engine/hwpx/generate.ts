import {
  indexHeaderValues,
  indexRows,
  type2ApplicationValues,
  type2ReportValues,
  type1Values,
} from '../placeholders.ts'
import type { Classroom, RequestRecord, Settings, Student } from '../types.ts'
import { fillXml } from './fill.ts'
import { buildIndexSection } from './indexTable.ts'
import { replaceImageSlots } from './imageSlot.ts'
import { appendReportEvidence } from './reportEvidence.ts'
import { cloneFiles, readHwpx, setTextFile, textFile, writeHwpx, type HwpxFiles } from './package.ts'

export type DocKind = 'type1' | 'type2-1' | 'type2-2' | 'type2-3'

function dataUrlBytes(dataUrl: string): Uint8Array | null {
  if (!dataUrl) return null
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return null
  const binary = atob(dataUrl.slice(comma + 1))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function loadTemplate(bytes: Uint8Array): Promise<HwpxFiles> {
  return readHwpx(bytes)
}

export async function renderHwpx(input: {
  template: Uint8Array
  kind: DocKind
  request?: RequestRecord
  student?: Student
  classroom: Classroom
  requests?: RequestRecord[]
  students?: Student[]
  settings: Pick<Settings, 'neisAutoMark' | 'signDataUrl' | 'stampDataUrl' | 'defaultSignature'>
  parentSignature?: Uint8Array | null
  reportEvidence?: Uint8Array[]
}): Promise<Uint8Array> {
  const files = cloneFiles(await readHwpx(input.template))
  if (input.kind === 'type2-3') {
    const sources = (input.requests ?? []).map((request) => {
      const student = (input.students ?? []).find((item) => item.id === request.studentId)
      if (!student) return null
      return { request, student }
    }).filter((item): item is { request: RequestRecord; student: Student } => Boolean(item))
    const rows = indexRows(sources, input.settings.neisAutoMark)
    const section = buildIndexSection(
      textFile(files, 'Contents/section0.xml'),
      indexHeaderValues(input.classroom),
      rows,
    )
    setTextFile(files, 'Contents/section0.xml', section)
    return writeHwpx(files)
  }

  if (!input.request || !input.student) throw new Error('문서에 필요한 신청 정보가 없습니다.')
  const teacherSlot = input.settings.defaultSignature === 'stamp' ? input.settings.stampDataUrl : input.settings.signDataUrl
  const teacher = dataUrlBytes(teacherSlot) ?? dataUrlBytes(input.settings.signDataUrl) ?? dataUrlBytes(input.settings.stampDataUrl)
  const parent = input.parentSignature ?? null
  await replaceImageSlots(files, {
    SIG_PARENT: parent,
    SIG_TEACHER: teacher,
  })
  const values = input.kind === 'type1'
    ? type1Values(input.request, input.student, input.classroom)
    : input.kind === 'type2-1'
      ? type2ApplicationValues(input.request, input.student, input.classroom)
      : type2ReportValues(input.request, input.student, input.classroom)
  setTextFile(files, 'Contents/section0.xml', fillXml(textFile(files, 'Contents/section0.xml'), values))
  if (input.kind === 'type2-2') appendReportEvidence(files, input.reportEvidence ?? [])
  return writeHwpx(files)
}
