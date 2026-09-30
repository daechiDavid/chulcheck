import * as XLSX from 'xlsx'
import type { StudentInput } from './actions.ts'

const HEADERS = ['번호', '이름', '성별', '부 이름', '부 전화', '모 이름', '모 전화'] as const

export function studentTemplateBytes(): Uint8Array {
  const sheet = XLSX.utils.aoa_to_sheet([
    [...HEADERS],
    [1, '홍길동', '남', '홍판서', '01012341111', '홍부인', '01012342222'],
  ])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, '명부')
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}

export function parseStudentSheet(data: ArrayBuffer | Uint8Array): StudentInput[] {
  const book = XLSX.read(data, { type: 'array' })
  const sheet = book.Sheets[book.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, raw: false })
  if (!rows.length) return []
  const header = rows[0].map((cell) => String(cell ?? '').trim())
  const index = new Map(header.map((name, i) => [name, i]))
  const col = (name: string) => index.get(name) ?? HEADERS.indexOf(name as (typeof HEADERS)[number])
  const body = header.includes('번호') ? rows.slice(1) : rows
  return body
    .filter((row) => row.some((cell) => String(cell ?? '').trim()))
    .map((row) => ({
      number: Number(String(row[col('번호')] ?? '').trim()),
      name: String(row[col('이름')] ?? '').trim(),
      gender: String(row[col('성별')] ?? '').trim() as StudentInput['gender'],
      fatherName: String(row[col('부 이름')] ?? '').trim(),
      motherName: String(row[col('모 이름')] ?? '').trim(),
      fatherPhone: String(row[col('부 전화')] ?? '').trim(),
      motherPhone: String(row[col('모 전화')] ?? '').trim(),
    }))
}
