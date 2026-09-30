import { useState } from 'react'
import { schoolYearOf, todayKST } from '@engine/dates'
import { BrandLogo } from '../components/BrandLogo'
import type { DesktopApi } from '../api'
import type { Snapshot } from '@engine/types'

export function Login({ api, remote, onDone }: { api: DesktopApi; remote: boolean; onDone: (snap: Snapshot) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [error, setError] = useState('')

  return (
    <main className="grid min-h-screen md:grid-cols-[0.85fr_1.15fr]">
      <section className="grid min-h-[420px] grid-rows-[auto_1fr_auto] bg-ink px-8 py-8 text-paper md:min-h-screen md:px-12 md:py-12">
        <BrandLogo className="justify-self-start" inverse size="lg" wordmarkClassName="!text-black" />
        <div className="self-center">
          <p className="text-sm text-paper/70">교사용</p>
          <h1 className="mt-2 font-display text-4xl leading-tight md:text-6xl">담임 업무 대장</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-paper/70 md:text-base">출결 신청을 확인하고 필요한 서류를 준비합니다.</p>
        </div>
        <p className="pt-8 text-sm !text-black">
          관리자 문의: <a className="!text-black underline underline-offset-4" href="mailto:gandyost@gmail.com">gandyost@gmail.com</a>
        </p>
      </section>
      <section className="flex items-center px-8 py-12 md:px-16">
        <form
          className="sheet w-full max-w-md p-8"
          onSubmit={async (event) => {
            event.preventDefault()
            setError('')
            try {
              onDone(await api.login({ email, password, name, schoolName }))
            } catch (err) {
              setError(err instanceof Error ? err.message : '로그인하지 못했습니다.')
            }
          }}
        >
          {/* <p className="text-sm tracking-[0.18em] text-brass">{remote ? 'SUPABASE' : 'LOCAL LEDGER'}</p> */}
          <h2 className="mt-2 font-display text-4xl">교사 로그인</h2>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            {remote
              ? '초대된 교사 이메일과 비밀번호로 들어옵니다. 이름과 학급은 다음 화면에서 등록합니다.'
              : '서버 계정은 나중에 붙입니다. 지금은 이 기기에 교사 계정을 만들고, 다음부터는 같은 이메일과 비밀번호로 들어옵니다.'}
          </p>
          <label className="mt-6 block text-sm">이메일<input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="mt-4 block text-sm">비밀번호<input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {remote ? null : (
            <>
              <label className="mt-4 block text-sm">이름<input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="처음 만들 때만" /></label>
              <label className="mt-4 block text-sm">학교<input className="field" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="처음 만들 때만" /></label>
            </>
          )}
          {error ? <p className="mt-4 text-sm text-seal">{error}</p> : null}
          <button className="btn btn-seal mt-8" type="submit">대장 열기</button>
        </form>
      </section>
    </main>
  )
}

export function Setup({ api, snap, onDone }: { api: DesktopApi; snap: Snapshot; onDone: (snap: Snapshot) => void }) {
  const year = schoolYearOf(todayKST())
  const [teacherName, setTeacherName] = useState(snap.session?.teacherName ?? '')
  const [schoolName, setSchoolName] = useState(snap.session?.schoolName ?? '')
  const [schoolYear, setSchoolYear] = useState(year)
  const [grade, setGrade] = useState(3)
  const [classNo, setClassNo] = useState(1)
  const [error, setError] = useState('')

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <p className="text-sm text-brass">초기 설정</p>
      <h1 className="font-display text-5xl">학급을 등록합니다</h1>
      <form
        className="sheet mt-8 p-6"
        onSubmit={async (event) => {
          event.preventDefault()
          try {
            onDone(await api.saveSetup({ teacherName, schoolName, schoolYear, grade, classNo }))
          } catch (err) {
            setError(err instanceof Error ? err.message : '저장하지 못했습니다.')
          }
        }}
      >
        <label className="block text-sm">담임 이름<input className="field" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} required /></label>
        <label className="mt-4 block text-sm">학교<input className="field" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required /></label>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <label className="text-sm">학년도<input className="field" type="number" value={schoolYear} onChange={(e) => setSchoolYear(Number(e.target.value))} /></label>
          <label className="text-sm">학년<input className="field" type="number" min={1} max={6} value={grade} onChange={(e) => setGrade(Number(e.target.value))} /></label>
          <label className="text-sm">반<input className="field" type="number" min={1} value={classNo} onChange={(e) => setClassNo(Number(e.target.value))} /></label>
        </div>
        {error ? <p className="mt-4 text-sm text-seal">{error}</p> : null}
        <button className="btn btn-seal mt-8" type="submit">학급 만들기</button>
      </form>
    </main>
  )
}
