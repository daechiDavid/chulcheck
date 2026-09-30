import type { DocType, Status } from './types.ts'

export const CATEGORY_LABEL: Record<number, string> = {
  1: '질병결석 3일 이상',
  2: '질병결석 2일 이하',
  3: '질병결석 2일 이하 가정보육',
  4: '미인정결석',
  5: '법정감염병',
  6: '경조사',
  7: '생리결석',
}

export const STATUS_LABEL: Record<Status, string> = {
  submitted: '제출됨',
  reviewed: '확인됨',
  rejected: '반려됨',
  cancelled: '취소됨',
}

export function docLabel(docType: DocType, category: number | null): string {
  if (docType === 'type2') return '교외체험학습'
  return CATEGORY_LABEL[category ?? 0] ?? '결석신고서'
}

export function documentFileLabel(kind: 'type1' | 'type2-1' | 'type2-2' | 'type2-3'): string {
  if (kind === 'type1') return '결석신고서'
  if (kind === 'type2-1') return '체험학습신청서'
  if (kind === 'type2-2') return '체험학습보고서'
  return '색인목록표'
}
