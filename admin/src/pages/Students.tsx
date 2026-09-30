import { useMemo, useState } from 'react'
import type { StudentInput } from '@engine/actions'
import { parseStudentSheet, studentTemplateBytes } from '@engine/sheet'
import type { DesktopApi } from '../api'
import type { Snapshot, Student } from '@engine/types'

function toInput(student: Student): StudentInput {
  return {
    number: student.number,
    name: student.name,
    gender: student.gender,
    fatherName: student.fatherName,
    motherName: student.motherName,
    fatherPhone: student.fatherPhoneLast4,
    motherPhone: student.motherPhoneLast4,
  }
}

export function Students({ api, snap, onChange }: { api: DesktopApi; snap: Snapshot; onChange: (snap: Snapshot) => void }) {
  const initial = useMemo(() => snap.students.filter((student) => student.active).map(toInput), [snap.students])
  const [rows, setRows] = useState<StudentInput[]>(initial)
  const [message, setMessage] = useState(snap.db.connected
    ? '전체 번호를 입력하면 서버에 암호화해 저장합니다. 4자리만 두면 기존 번호를 유지합니다.'
    : '전화번호는 저장 후 뒤 4자리만 남습니다. 칸을 비우면 기존 뒷자리를 유지합니다.')
  const [showInactive, setShowInactive] = useState(false)

  const update = (index: number, patch: Partial<StudentInput>) => {
    setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row))
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-brass">명부</p>
          <h1 className="font-display text-5xl">학생</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => {
            const bytes = studentTemplateBytes()
            const copy = new Uint8Array(bytes.byteLength)
            copy.set(bytes)
            const blob = new Blob([copy.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = '학생명부.xlsx'
            link.click()
            URL.revokeObjectURL(url)
          }}>양식 받기</button>
          <label className="btn cursor-pointer">엑셀 가져오기
            <input className="hidden" type="file" accept=".xlsx,.csv" onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              setRows(parseStudentSheet(await file.arrayBuffer()))
              setMessage('가져온 목록을 확인한 뒤 저장하세요. 빠뜨린 번호는 비활성됩니다.')
            }} />
          </label>
          <button type="button" className="btn" onClick={() => setRows((current) => [...current, { number: current.length + 1, name: '', gender: '남', fatherName: '', motherName: '', fatherPhone: '', motherPhone: '' }])}>행 추가</button>
          <button type="button" className="btn btn-seal" onClick={async () => {
            try {
              const result = await api.saveStudents(rows.filter((row) => row.name.trim()))
              onChange(result.snapshot)
              setRows(result.snapshot.students.filter((student) => student.active).map(toInput))
              setMessage(`추가 ${result.inserted}, 수정 ${result.updated}, 비활성 ${result.deactivated}`)
            } catch (err) {
              setMessage(err instanceof Error ? err.message : '저장하지 못했습니다.')
            }
          }}>명부 저장</button>
        </div>
      </div>
      <p className="mt-3 text-sm">{message}</p>
      <table className="ledger mt-4 w-full text-sm">
        <thead><tr><th>번호</th><th>이름</th><th>성별</th><th>부</th><th>부 전화</th><th>모</th><th>모 전화</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.number}-${index}`}>
              <td><input className="field w-16" type="number" value={row.number} onChange={(e) => update(index, { number: Number(e.target.value) })} /></td>
              <td><input className="field" value={row.name} onChange={(e) => update(index, { name: e.target.value })} /></td>
              <td>
                <select className="bg-transparent" value={row.gender} onChange={(e) => update(index, { gender: e.target.value as '남' | '여' })}>
                  <option>남</option><option>여</option>
                </select>
              </td>
              <td><input className="field" value={row.fatherName} onChange={(e) => update(index, { fatherName: e.target.value })} /></td>
              <td><input className="field w-24" value={row.fatherPhone} onChange={(e) => update(index, { fatherPhone: e.target.value })} /></td>
              <td><input className="field" value={row.motherName} onChange={(e) => update(index, { motherName: e.target.value })} /></td>
              <td><input className="field w-24" value={row.motherPhone} onChange={(e) => update(index, { motherPhone: e.target.value })} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="mt-4 text-sm underline" onClick={() => setShowInactive((value) => !value)}>비활성 학생 {showInactive ? '숨기기' : '보기'}</button>
      {showInactive ? <p className="mt-2 text-sm">{snap.students.filter((student) => !student.active).map((student) => `${student.number} ${student.name}`).join(', ') || '없음'}</p> : null}
    </section>
  )
}
