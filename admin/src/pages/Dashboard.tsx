import { docLabel, STATUS_LABEL } from '@engine/labels'
import type { RequestView } from '@engine/types'

const TABS = [
  ['submitted', '제출됨'],
  ['reviewed', '확인됨'],
  ['printed', '출력됨'],
  ['rejected', '반려됨'],
  ['cancelled', '취소됨'],
] as const

export type Bucket = (typeof TABS)[number][0]

export function bucketOf(request: RequestView): Bucket {
  if (request.status === 'rejected') return 'rejected'
  if (request.status === 'cancelled') return 'cancelled'
  if (request.printedAt || request.reportPrintedAt) return 'printed'
  if (request.status === 'reviewed') return 'reviewed'
  return 'submitted'
}

export function Dashboard({
  requests,
  tab,
  onTab,
  docFilter,
  onDocFilter,
  selected,
  onToggle,
  onOpen,
  onPrintSelected,
  onPrintUnprinted,
  connected,
  onSeed,
  onSimulate,
}: {
  requests: RequestView[]
  tab: Bucket
  onTab: (tab: Bucket) => void
  docFilter: 'all' | 'type1' | 'type2'
  onDocFilter: (value: 'all' | 'type1' | 'type2') => void
  selected: string[]
  onToggle: (id: string) => void
  onOpen: (id: string) => void
  onPrintSelected: () => void
  onPrintUnprinted: () => void
  connected: boolean
  onSeed: () => void
  onSimulate: () => void
}) {
  const rows = requests.filter((request) => bucketOf(request) === tab && (docFilter === 'all' || request.docType === docFilter))
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-brass">오늘 대장</p>
          <h1 className="font-display text-5xl">신청 목록</h1>
          {connected ? <p className="mt-2 text-sm text-ink/70">학부모 제출은 이 목록에 바로 들어옵니다.</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {connected ? null : <button type="button" className="btn" onClick={onSeed}>샘플 넣기</button>}
          {connected ? null : <button type="button" className="btn" onClick={onSimulate}>접수 알림 시험</button>}
          <button type="button" className="btn" disabled={!selected.length} onClick={onPrintSelected}>선택 출력</button>
          <button type="button" className="btn btn-seal" onClick={onPrintUnprinted}>미출력 전체 출력</button>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={`stamp ${tab === id ? 'bg-ink text-paper' : ''}`} onClick={() => onTab(id)}>
            {label} {requests.filter((request) => bucketOf(request) === id).length}
          </button>
        ))}
        <select className="ml-auto bg-transparent" value={docFilter} onChange={(e) => onDocFilter(e.target.value as 'all' | 'type1' | 'type2')}>
          <option value="all">모든 서류</option>
          <option value="type1">결석신고서</option>
          <option value="type2">체험학습</option>
        </select>
      </div>
      <table className="ledger mt-4 w-full text-sm">
        <thead>
          <tr>
            <th />
            <th>번호</th>
            <th>이름</th>
            <th>서류</th>
            <th>기간</th>
            <th>일수</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((request) => (
            <tr key={request.id}>
              <td><input type="checkbox" checked={selected.includes(request.id)} onChange={() => onToggle(request.id)} aria-label="선택" /></td>
              <td className="tabular-nums">{request.studentNumber}</td>
              <td>
                <button type="button" className="underline decoration-brass underline-offset-4" onClick={() => onOpen(request.id)}>{request.studentName}</button>
              </td>
              <td>
                {docLabel(request.docType, request.category)}
                {request.reportMissing ? <span className="ml-2 text-brass">보고서 미제출</span> : null}
              </td>
              <td className="tabular-nums">{request.startDate} ~ {request.endDate}</td>
              <td className="tabular-nums">{request.periodDays}</td>
              <td>
                <span className="stamp">{STATUS_LABEL[request.status]}</span>
                {request.warnings.length ? <span className="ml-2 text-seal" title={request.warnings.map((warning) => warning.message).join('\n')}>경고 {request.warnings.length}</span> : null}
              </td>
            </tr>
          ))}
          {!rows.length ? <tr><td colSpan={7} className="py-8 text-ink/60">이 칸은 비어 있습니다.</td></tr> : null}
        </tbody>
      </table>
    </section>
  )
}
