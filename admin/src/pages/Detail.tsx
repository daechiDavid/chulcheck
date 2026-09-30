import { useEffect, useState } from 'react'
import { periodDays } from '@engine/period'
import { CATEGORY_LABEL, docLabel, STATUS_LABEL } from '@engine/labels'
import type { DocKind } from '@engine/hwpx/generate'
import type { DesktopApi } from '../api'
import type { RequestView, Snapshot } from '@engine/types'

export function Detail({
  api,
  snap,
  request,
  onChange,
  onBack,
}: {
  api: DesktopApi
  snap: Snapshot
  request: RequestView
  onChange: (snap: Snapshot) => void
  onBack: () => void
}) {
  const [reason, setReason] = useState('')
  const [editing, setEditing] = useState(false)
  const [startDate, setStartDate] = useState(request.startDate)
  const [endDate, setEndDate] = useState(request.endDate)
  const [category, setCategory] = useState(request.category ?? 1)
  const [guardianName, setGuardianName] = useState(request.guardianName)
  const [text, setText] = useState(request.fields.reason ?? '')
  const [date4, setDate4] = useState(request.fields.date4 ?? request.startDate)
  const [place, setPlace] = useState(request.fields.place ?? '')
  const [content, setContent] = useState(request.fields.content ?? '')
  const [plan, setPlan] = useState(request.fields.plan ?? '')
  const [evidence, setEvidence] = useState(request.fields.evidence ?? [])
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [evidenceImages, setEvidenceImages] = useState<Array<{ path: string; url: string }>>([])
  const [evidenceError, setEvidenceError] = useState('')
  const evidencePathKey = (request.reportEvidencePaths ?? []).join('|')
  useEffect(() => {
    let active = true
    setEvidenceImages([])
    setEvidenceError('')
    if (!request.reportSubmittedOn || !evidencePathKey) return () => { active = false }
    void api.reportEvidenceUrls(request.id)
      .then((images) => { if (active) setEvidenceImages(images) })
      .catch((err: unknown) => { if (active) setEvidenceError(err instanceof Error ? err.message : '증빙 사진을 불러오지 못했습니다.') })
    return () => { active = false }
  }, [api, request.id, request.reportSubmittedOn, evidencePathKey])
  const preview = periodDays(startDate, endDate, snap.offDays.map((day) => day.date))

  const run = async (work: () => Promise<Snapshot | { path: string; filename: string } | { files: string[]; note: string }>) => {
    setError('')
    try {
      const result = await work()
      if ('requests' in result) onChange(result)
      else if ('note' in result) setNote(result.note)
      else setNote(`${result.filename}을 만들었습니다.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리하지 못했습니다.')
    }
  }

  const generate = (kind: DocKind) => run(() => api.generate({ kind, requestId: request.id }))

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <button type="button" className="text-sm underline" onClick={onBack}>목록</button>
        <p className="mt-3 text-sm text-brass">{request.studentNumber}번 · {request.gender}</p>
        <h1 className="font-display text-5xl">{request.studentName}</h1>
        <p className="mt-2">{docLabel(request.docType, request.category)} · <span className="stamp">{STATUS_LABEL[request.status]}</span></p>
        {request.rejectReason ? <p className="mt-3 text-seal">반려 사유: {request.rejectReason}</p> : null}
        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-ink/50">기간</dt><dd>{request.startDate} ~ {request.endDate} ({request.periodDays}일)</dd></div>
          <div><dt className="text-ink/50">제출</dt><dd>{request.submittedOn} · {request.guardianName}</dd></div>
          <div><dt className="text-ink/50">출력</dt><dd>{request.printedAt ? '신청서 출력됨' : '신청서 미출력'} / {request.reportPrintedAt ? '보고서 출력됨' : '보고서 미출력'}</dd></div>
          <div><dt className="text-ink/50">보고서</dt><dd>{request.reportSubmittedOn ?? '미제출'}</dd></div>
        </dl>
        <div className="mt-4 text-sm leading-6">
          {request.docType === 'type1' ? <p>사유: {request.fields.reason}</p> : (
            <>
              <p>장소: {request.fields.place}</p>
              <p className="mt-2 whitespace-pre-wrap">학습 내용: {request.fields.content}</p>
              <p className="mt-2 whitespace-pre-wrap">계획: {request.fields.plan}</p>
            </>
          )}
        </div>
        {request.docType === 'type2' && request.reportSubmittedOn ? (
          <section className="mt-6 rounded-xl border border-rule bg-white p-4">
            <h2 className="font-display text-xl">실제 체험 내용</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{request.reportContent || '보고서 내용이 저장되어 있지 않습니다.'}</p>
            <h3 className="mt-4 text-sm font-medium">증빙 사진</h3>
            {evidenceError ? <p className="mt-2 text-sm text-seal">{evidenceError}</p> : null}
            {evidenceImages.length ? (
              <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {evidenceImages.map((image, index) => (
                  <li key={image.path}>
                    <a href={image.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-rule">
                      <img src={image.url} alt={`증빙 사진 ${index + 1}`} className="aspect-square w-full object-cover" />
                      <span className="block px-2 py-1 text-xs text-ink/70">사진 {index + 1} · 크게 보기</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : !evidenceError ? <p className="mt-1 text-sm text-ink/60">첨부된 사진이 없습니다.</p> : null}
          </section>
        ) : null}
        {request.warnings.length ? (
          <ul className="mt-4 list-disc pl-5 text-sm text-seal">
            {request.warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}
          </ul>
        ) : null}
      </div>
      <div className="sheet p-5">
        <h2 className="font-display text-3xl">처리</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={request.status !== 'submitted'} onClick={() => run(() => api.review(request.id))}>확인</button>
          <button type="button" className="btn" onClick={() => setEditing((value) => !value)}>값 수정</button>
          {request.docType === 'type1' ? <button type="button" className="btn" onClick={() => generate('type1')}>결석신고서</button> : null}
          {request.docType === 'type2' ? <button type="button" className="btn" onClick={() => generate('type2-1')}>신청서</button> : null}
          {request.docType === 'type2' ? <button type="button" className="btn" disabled={!request.reportSubmittedOn} onClick={() => generate('type2-2')}>보고서</button> : null}
          <button type="button" className="btn btn-seal" onClick={() => run(() => api.printRun({ items: [{ kind: request.docType === 'type1' ? 'type1' : 'type2-1', requestId: request.id }] }))}>개별 출력</button>
        </div>
        {request.status === 'submitted' ? (
          <form className="mt-4" onSubmit={(event) => { event.preventDefault(); void run(() => api.reject(request.id, reason)) }}>
            <label className="text-sm">반려 사유<textarea className="field" value={reason} onChange={(e) => setReason(e.target.value)} required /></label>
            <button className="btn mt-3" type="submit">반려</button>
          </form>
        ) : null}
        {editing ? (
          <form
            className="mt-4 border-t border-rule pt-4"
            onSubmit={(event) => {
              event.preventDefault()
              void run(() => api.update(request.id, request.docType === 'type1'
                ? { startDate, endDate, category, guardianName, fields: { reason: text, date4, evidence } }
                : { startDate, endDate, guardianName, fields: { place, content, plan } }))
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">시작<input className="field" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
              <label className="text-sm">종료<input className="field" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
            </div>
            <p className="mt-2 text-sm">미리보기 수업일수 {preview}일</p>
            <label className="mt-3 block text-sm">보호자<input className="field" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} /></label>
            {request.docType === 'type1' ? (
              <>
                <label className="mt-3 block text-sm">사유 번호
                  <select className="field" value={category} onChange={(e) => setCategory(Number(e.target.value))}>
                    {Object.entries(CATEGORY_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label>
                <label className="mt-3 block text-sm">내용<textarea className="field" value={text} onChange={(e) => setText(e.target.value)} /></label>
                {category === 4 ? <label className="mt-3 block text-sm">미인정 시작일<input className="field" type="date" value={date4} onChange={(e) => setDate4(e.target.value)} /></label> : null}
                {category === 6 ? (
                  <div className="mt-3 flex gap-3 text-sm">
                    {(['r1', 'r2', 'r3'] as const).map((id) => (
                      <label key={id}><input type="checkbox" checked={evidence.includes(id)} onChange={() => setEvidence((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} /> {id === 'r1' ? '청첩장' : id === 'r2' ? '부고장' : '기타'}</label>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <label className="mt-3 block text-sm">장소<input className="field" value={place} onChange={(e) => setPlace(e.target.value)} /></label>
                <label className="mt-3 block text-sm">학습 내용<textarea className="field" value={content} onChange={(e) => setContent(e.target.value)} /></label>
                <label className="mt-3 block text-sm">학습 계획<textarea className="field" value={plan} onChange={(e) => setPlan(e.target.value)} /></label>
              </>
            )}
            <button className="btn btn-seal mt-4" type="submit">수정 저장</button>
          </form>
        ) : null}
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn" onClick={() => run(() => api.markPrinted(request.id, 'form'))}>신청서 출력됨으로 표시</button>
          {request.docType === 'type2' ? <button type="button" className="btn" onClick={() => run(() => api.markPrinted(request.id, 'report'))}>보고서 출력됨으로 표시</button> : null}
        </div>
        {error ? <p className="mt-3 text-sm text-seal">{error}</p> : null}
        {note ? <p className="mt-3 text-sm">{note}</p> : null}
      </div>
    </section>
  )
}
