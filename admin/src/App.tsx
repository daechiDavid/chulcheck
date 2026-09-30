import { useEffect, useState } from 'react'
import type { DesktopApi } from './api'
import { loadApi } from './api'
import { BrandLogo } from './components/BrandLogo'
import { Login, Setup } from './pages/Login'
import { Dashboard, type Bucket } from './pages/Dashboard'
import { Detail } from './pages/Detail'
import { Students } from './pages/Students'
import { CalendarPage } from './pages/CalendarPage'
import { IndexList } from './pages/IndexList'
import { PrintPage } from './pages/PrintPage'
import { SettingsPage } from './pages/SettingsPage'
import type { Snapshot } from '@engine/types'

type Page = 'dash' | 'students' | 'calendar' | 'index' | 'print' | 'settings' | 'detail'

const NAV: Array<[Page, string]> = [
  ['dash', '대장'],
  ['students', '명부'],
  ['calendar', '휴업일'],
  ['index', '목록표'],
  ['print', '출력'],
  ['settings', '설정'],
]

export function App() {
  const [api, setApi] = useState<DesktopApi | null>(null)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [page, setPage] = useState<Page>('dash')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [tab, setTab] = useState<Bucket>('submitted')
  const [docFilter, setDocFilter] = useState<'all' | 'type1' | 'type2'>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [job, setJob] = useState<{ requestIds?: string[]; unprintedOnly: boolean }>({ unprintedOnly: true })
  const [toast, setToast] = useState('')

  useEffect(() => {
    let stopOpen = () => {}
    let stopLive = () => {}
    let cancelled = false
    void loadApi().then(async (next) => {
      if (cancelled) return
      setApi(next)
      setSnap(await next.snapshot())
      stopOpen = next.onOpenRequest((id) => {
        setDetailId(id)
        setPage('detail')
        void next.ack()
      })
      stopLive = next.onSnapshot((incoming) => setSnap(incoming))
    })
    return () => {
      cancelled = true
      stopOpen()
      stopLive()
    }
  }, [])

  if (!api || !snap) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <BrandLogo size="lg" />
        <p className="text-sm text-ink/60">교사용 앱을 여는 중입니다.</p>
      </main>
    )
  }
  if (!snap.session) return <Login api={api} remote={snap.db.connected} onDone={setSnap} />
  if (snap.loadError && !snap.classroom) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="sheet max-w-md p-8">
          <h1 className="font-display text-4xl">연결</h1>
          <p className="mt-4 text-sm leading-6">{snap.loadError}</p>
          <button className="btn btn-seal mt-6" type="button" onClick={async () => setSnap(await api.reload())}>다시 불러오기</button>
        </div>
      </main>
    )
  }
  if (!snap.classroom) return <Setup api={api} snap={snap} onDone={setSnap} />

  const room = snap.classroom
  const detail = snap.requests.find((request) => request.id === detailId)

  return (
    <div className="grid min-h-screen md:grid-cols-[220px_1fr]">
      <aside className="flex flex-col bg-ink px-5 py-6 text-paper">
        <BrandLogo className="self-start" inverse size="sm" />
        <p className="mt-4 font-display text-3xl leading-tight">{room.grade}학년 {room.classNo}반</p>
        <p className="mt-1 text-sm text-paper/70">{snap.session.schoolName}<br />{snap.session.teacherName}</p>
        <nav className="mt-8 grid gap-2">
          {NAV.map(([id, label]) => (
            <button key={id} type="button" className={`text-left ${page === id ? 'text-brass' : 'text-paper/80'}`} onClick={() => setPage(id)}>{label}</button>
          ))}
        </nav>
        <p className="mt-auto text-xs leading-5 text-paper/50">{snap.db.connected ? '서버에 연결되어 있습니다.' : '로컬 모드. 서버 연결 전입니다.'}</p>
      </aside>
      <main className="px-6 py-8 md:px-10">
        {toast ? <p className="mb-4 border border-seal px-3 py-2 text-sm text-seal">{toast}</p> : null}
        {page === 'dash' ? (
          <Dashboard
            requests={snap.requests}
            tab={tab}
            onTab={setTab}
            docFilter={docFilter}
            onDocFilter={setDocFilter}
            selected={selected}
            onToggle={(id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
            onOpen={(id) => { setDetailId(id); setPage('detail'); void api.ack() }}
            onPrintSelected={() => { setJob({ requestIds: selected, unprintedOnly: false }); setPage('print') }}
            onPrintUnprinted={() => { setJob({ unprintedOnly: true }); setPage('print') }}
            connected={snap.db.connected}
            onSeed={async () => { setSnap(await api.seed()); setToast('샘플 명부와 신청을 넣었습니다.') }}
            onSimulate={async () => {
              const result = await api.simulate()
              setSnap(result.snapshot)
              setToast(result.title)
            }}
          />
        ) : null}
        {page === 'detail' && detail ? <Detail api={api} snap={snap} request={detail} onChange={setSnap} onBack={() => setPage('dash')} /> : null}
        {page === 'students' ? <Students api={api} snap={snap} onChange={setSnap} /> : null}
        {page === 'calendar' ? <CalendarPage api={api} snap={snap} onChange={setSnap} /> : null}
        {page === 'index' ? <IndexList api={api} snap={snap} /> : null}
        {page === 'print' ? <PrintPage api={api} job={job} onChange={setSnap} /> : null}
        {page === 'settings' ? <SettingsPage api={api} snap={snap} onChange={(next) => { setSnap(next); if (!next.session) setPage('dash') }} /> : null}
      </main>
    </div>
  )
}
