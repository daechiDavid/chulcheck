import { useState } from 'react'
import { indexRows } from '@engine/placeholders'
import type { DesktopApi } from '../api'
import type { Snapshot } from '@engine/types'

export function IndexList({ api, snap }: { api: DesktopApi; snap: Snapshot }) {
  const [note, setNote] = useState('')
  const rows = indexRows(
    snap.requests.map((request) => {
      const student = snap.students.find((item) => item.id === request.studentId)
      return student ? { request, student } : null
    }).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    snap.settings.neisAutoMark,
  )
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-brass">{snap.classroom?.schoolYear}학년도</p>
          <h1 className="font-display text-5xl">색인 목록표</h1>
        </div>
        <button type="button" className="btn btn-seal" onClick={async () => {
          try {
            const file = await api.generate({ kind: 'type2-3' })
            setNote(`${file.filename}을 만들었습니다.`)
          } catch (err) {
            setNote(err instanceof Error ? err.message : '만들지 못했습니다.')
          }
        }}>목록표 생성</button>
      </div>
      <p className="mt-3 text-sm">누적 19일을 넘으면 화면에서만 붉게 표시합니다. 출력물에는 숫자만 들어갑니다.</p>
      {note ? <p className="mt-2 text-sm">{note}</p> : null}
      <table className="ledger mt-4 w-full text-sm">
        <thead><tr><th>번호</th><th>학생</th><th>기간</th><th>장소</th><th>보고서</th><th>나이스</th><th>누적</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.studentId}-${row.no}`} className={row.overCumulative ? 'text-seal' : ''}>
              <td>{row.no}</td>
              <td>{row.studentNumber} {row.studentName}</td>
              <td>{row.range}</td>
              <td>{row.place}</td>
              <td>{row.rptMark || '·'}</td>
              <td>{row.neisMark || '·'}</td>
              <td className="tabular-nums">{row.addpr}</td>
            </tr>
          ))}
          {!rows.length ? <tr><td colSpan={7}>체험학습 신청이 없습니다.</td></tr> : null}
        </tbody>
      </table>
    </section>
  )
}
