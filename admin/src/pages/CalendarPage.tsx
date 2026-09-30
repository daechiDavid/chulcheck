import { useState } from 'react'
import { addDaysYmd, todayKST } from '@engine/dates'
import type { DesktopApi } from '../api'
import type { Snapshot } from '@engine/types'

function monthGrid(year: number, month: number): Array<string | null> {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const startPad = new Date(year, month - 1, 1).getDay()
  const cells: Array<string | null> = Array.from({ length: startPad }, () => null)
  let cursor = first
  while (cursor.slice(0, 7) === first.slice(0, 7)) {
    cells.push(cursor)
    cursor = addDaysYmd(cursor, 1)
  }
  return cells
}

export function CalendarPage({ api, snap, onChange }: { api: DesktopApi; snap: Snapshot; onChange: (snap: Snapshot) => void }) {
  const today = todayKST()
  const [cursor, setCursor] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState(today)
  const [label, setLabel] = useState('재량휴업일')
  const [message, setMessage] = useState(snap.db.connected
    ? '공휴일 동기화는 공공데이터에서 학년도 휴일을 가져옵니다. 같은 날짜의 재량휴업일은 유지합니다.'
    : '공휴일 불러오기는 연결 전 내장 목록입니다. 공공데이터 동기화는 DB 연결 후 sync-holidays가 합니다.')
  const [year, month] = cursor.split('-').map(Number)
  const byDate = new Map(snap.offDays.map((day) => [day.date, day]))
  const affected = snap.requests.filter((request) => request.startDate <= selected && request.endDate >= selected && request.status !== 'cancelled' && request.status !== 'rejected')

  return (
    <section>
      <p className="text-sm text-brass">수업일수 기준</p>
      <h1 className="font-display text-5xl">휴업일</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => setCursor((value) => addDaysYmd(`${value}-01`, -1).slice(0, 7))}>이전달</button>
        <p className="font-display text-3xl">{year}.{month}</p>
        <button type="button" className="btn" onClick={() => setCursor((value) => addDaysYmd(`${value}-28`, 7).slice(0, 7))}>다음달</button>
        <button type="button" className="btn btn-seal" onClick={async () => {
          try {
            onChange(await api.loadHolidays())
            setMessage(snap.db.connected
              ? '공공데이터 공휴일을 불러왔습니다. 같은 날짜의 재량휴업일은 그대로 둡니다.'
              : '내장 공휴일을 넣었습니다. 같은 날짜의 재량휴업일은 유지합니다.')
          } catch (error) {
            setMessage(error instanceof Error ? error.message : '공휴일을 불러오지 못했습니다.')
          }
        }}>{snap.db.connected ? '공휴일 동기화' : '내장 공휴일 불러오기'}</button>
      </div>
      <div className="mt-6 grid grid-cols-7 gap-1 text-center text-sm">
        {['일', '월', '화', '수', '목', '금', '토'].map((day) => <div key={day} className="text-ink/50">{day}</div>)}
        {monthGrid(year, month).map((date, index) => {
          const off = date ? byDate.get(date) : undefined
          return (
            <button
              key={`${date}-${index}`}
              type="button"
              disabled={!date}
              className={`h-16 border border-rule ${date === selected ? 'border-ink' : ''} ${off ? 'bg-ink/10' : ''}`}
              onClick={() => date && setSelected(date)}
            >
              <span className="block tabular-nums">{date?.slice(8)}</span>
              {off ? <span className="block truncate text-[10px]">{off.label}</span> : null}
            </button>
          )
        })}
      </div>
      <form className="sheet mt-6 flex flex-wrap items-end gap-3 p-4" onSubmit={async (event) => {
        event.preventDefault()
        try {
          onChange(await api.addOff(selected, label))
          setMessage(`${selected}을 재량휴업일로 넣었습니다.`)
        } catch (err) {
          setMessage(err instanceof Error ? err.message : '넣지 못했습니다.')
        }
      }}>
        <div>
          <p className="text-sm">선택한 날 {selected}</p>
          <input className="field" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="휴업일 이름" />
        </div>
        <button className="btn" type="submit">재량휴업일 등록</button>
        <button type="button" className="btn" onClick={async () => {
          try { onChange(await api.removeOff(selected)); setMessage('재량휴업일을 지웠습니다.') }
          catch (err) { setMessage(err instanceof Error ? err.message : '지우지 못했습니다.') }
        }}>삭제</button>
      </form>
      <p className="mt-3 text-sm">{message}</p>
      {affected.length ? (
        <div className="mt-4">
          <p className="text-sm">이 날이 포함된 신청 {affected.length}건</p>
          <button type="button" className="btn mt-2" onClick={async () => onChange(await api.recalculate(affected.map((request) => request.id)))}>일수 다시 계산</button>
          <ul className="mt-2 text-sm">
            {affected.map((request) => <li key={request.id}>{request.studentNumber} {request.studentName} {request.startDate}~{request.endDate} ({request.periodDays}일)</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
