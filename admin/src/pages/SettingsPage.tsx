import { SignatureStudio } from '../components/SignatureStudio'
import type { DesktopApi } from '../api'
import type { Settings, Snapshot } from '@engine/types'

export function SettingsPage({ api, snap, onChange }: { api: DesktopApi; snap: Snapshot; onChange: (snap: Snapshot) => void }) {
  const settings = snap.settings
  const save = async (patch: Partial<Settings>) => onChange(await api.saveSettings(patch))
  return (
    <section className="max-w-3xl">
      <p className="text-sm text-brass">이 컴퓨터</p>
      <h1 className="font-display text-5xl">설정</h1>
      <div className="sheet mt-6 p-5 text-sm leading-6">
        <p className="font-display text-2xl">데이터베이스</p>
        <p className="mt-2">{snap.db.message}</p>
        <p className="mt-2 text-ink/70">{snap.db.connected
          ? '교사 로그인과 조회는 이 PC의 세션으로 합니다. service_role 키는 앱에 없습니다. 명부·내용 수정·공휴일 동기화는 교사용 Edge Function이 처리합니다.'
          : '환경 변수 MAIN_VITE_SUPABASE_URL, MAIN_VITE_SUPABASE_PUBLISHABLE_KEY. service_role 키는 사용하지 않습니다.'}</p>
      </div>
      <div className="mt-6 grid gap-4">
        <label className="text-sm">프린터 이름
          <input className="field" value={settings.printer} onChange={(e) => void save({ printer: e.target.value })} placeholder="Windows 프린터 이름" />
        </label>
        <div className="flex items-end gap-3">
          <label className="flex-1 text-sm">저장 폴더
            <input className="field" value={settings.outputDir} readOnly placeholder="기본: 문서/출결서류" />
          </label>
          <button type="button" className="btn" onClick={async () => onChange(await api.pickFolder())}>폴더 선택</button>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.neisAutoMark} onChange={(e) => void save({ neisAutoMark: e.target.checked })} /> 목록표 나이스 칸도 자동 ○</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.openAtLogin} onChange={(e) => void save({ openAtLogin: e.target.checked })} /> Windows/Mac 로그인 시 자동 실행</label>
        <fieldset>
          <legend className="text-sm">결재란 기본 도장</legend>
          <label className="mr-4 text-sm"><input type="radio" checked={settings.defaultSignature === 'sign'} onChange={() => void save({ defaultSignature: 'sign' })} /> 서명</label>
          <label className="text-sm"><input type="radio" checked={settings.defaultSignature === 'stamp'} onChange={() => void save({ defaultSignature: 'stamp' })} /> 도장</label>
        </fieldset>
        <div className="grid gap-4 md:grid-cols-2">
          <SignatureStudio label="서명" dataUrl={settings.signDataUrl} onChange={(signDataUrl) => void save({ signDataUrl })} />
          <SignatureStudio label="도장" dataUrl={settings.stampDataUrl} onChange={(stampDataUrl) => void save({ stampDataUrl })} />
        </div>
        <button type="button" className="btn w-fit" onClick={async () => onChange(await api.logout())}>로그아웃</button>
      </div>
    </section>
  )
}
