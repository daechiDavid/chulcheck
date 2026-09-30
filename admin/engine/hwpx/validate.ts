import { extractPlaceholderKeys } from './fill.ts'
import { TYPE1_KEYS, TYPE2_APP_KEYS, TYPE2_INDEX_HEADER_KEYS, TYPE2_INDEX_ROW_KEYS, TYPE2_REPORT_KEYS } from '../placeholders.ts'

const EXPECTED: Record<string, string[]> = {
  type1: TYPE1_KEYS,
  'type2-1': TYPE2_APP_KEYS,
  'type2-2': TYPE2_REPORT_KEYS,
  'type2-3': [...TYPE2_INDEX_HEADER_KEYS, ...TYPE2_INDEX_ROW_KEYS],
}

export function assertTemplateKeys(kind: string, xml: string): void {
  const expected = EXPECTED[kind]
  if (!expected) throw new Error(`알 수 없는 양식: ${kind}`)
  const actual = new Set(extractPlaceholderKeys(xml))
  const missing = expected.filter((key) => !actual.has(key))
  const extra = [...actual].filter((key) => !expected.includes(key))
  if (missing.length || extra.length) {
    throw new Error(`${kind} 키 불일치. 없음: ${missing.join(', ') || '-'}. 추가: ${extra.join(', ') || '-'}`)
  }
}
