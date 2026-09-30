import { useEffect, useState } from 'react'
import type { PrintItem } from '@engine/printSort'
import type { DesktopApi } from '../api'
import type { Snapshot } from '@engine/types'

export function PrintPage({
  api,
  job,
  onChange,
}: {
  api: DesktopApi
  job: { requestIds?: string[]; unprintedOnly: boolean }
  onChange: (snap: Snapshot) => void
}) {
  const [includeIndex, setIncludeIndex] = useState(false)
  const [items, setItems] = useState<PrintItem[]>([])
  const [note, setNote] = useState('순서를 확인한 뒤 출력하세요. 신청서 다음에 같은 체험학습 보고서가 붙습니다.')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void api.printPlan({ ...job, includeIndex }).then(setItems).catch((err: unknown) => {
      setNote(err instanceof Error ? err.message : '순서를 만들지 못했습니다.')
    })
  }, [api, job, includeIndex])

  return (
    <section>
      <p className="text-sm text-brass">출력 대기열</p>
      <h1 className="font-display text-5xl">인쇄 순서</h1>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={includeIndex} onChange={(e) => setIncludeIndex(e.target.checked)} />
        색인 목록표를 맨 뒤에 붙이기
      </label>
      <ol className="mt-4 space-y-2">
        {items.map((item, index) => (
          <li key={item.id} className="flex gap-3 border-b border-rule py-2 text-sm">
            <span className="w-8 tabular-nums">{index + 1}</span>
            <span>{item.label}</span>
            <span>{item.studentNumber < 9000 ? `${item.studentNumber} ${item.studentName}` : ''}</span>
            <span className="text-ink/50">{item.startDate.startsWith('9999') ? '' : item.startDate}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-seal" disabled={busy || !items.length} onClick={async () => {
          setBusy(true)
          try {
            const result = await api.printRun({ items: items.map((item) => ({ kind: item.kind, requestId: item.requestId ?? undefined })) })
            setNote(result.note)
          } catch (err) {
            setNote(err instanceof Error ? err.message : '출력하지 못했습니다.')
          } finally {
            setBusy(false)
          }
        }}>{busy ? '만드는 중' : '이 순서로 만들기'}</button>
        <button type="button" className="btn" onClick={async () => {
          let snap: Snapshot | null = null
          for (const item of items) {
            if (!item.requestId) continue
            snap = await api.markPrinted(item.requestId, item.kind === 'type2-2' ? 'report' : 'form')
          }
          if (snap) onChange(snap)
          setNote('출력됨으로 표시했습니다. 상태 값은 바꾸지 않습니다.')
        }}>만든 문서를 출력됨으로 표시</button>
      </div>
      <p className="mt-3 text-sm leading-6">{note}</p>
    </section>
  )
}
