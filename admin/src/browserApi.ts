import { LocalApp } from '@engine/app'
import { documentFileLabel } from '@engine/labels'
import type { DocKind } from '@engine/hwpx/generate'
import { defaultSettings, emptyState } from '@engine/types'
import type { DesktopApi } from './api'

const KEY = 'chulcheck-admin-local'

function download(bytes: Uint8Array, filename: string): void {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const blob = new Blob([copy.buffer])
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function templateOf(kind: DocKind): Promise<Uint8Array> {
  const response = await fetch(`/${kind}.hwpx`)
  if (!response.ok) throw new Error('양식 파일을 불러오지 못했습니다. templates를 먼저 생성하세요.')
  return new Uint8Array(await response.arrayBuffer())
}

export function createBrowserApi(): DesktopApi {
  const saved = localStorage.getItem(KEY)
  const parsed = saved ? JSON.parse(saved) as { state?: ConstructorParameters<typeof LocalApp>[0]; settings?: Partial<import('@engine/types').Settings>; loggedIn?: boolean } : null
  const app = new LocalApp(parsed?.state ?? emptyState(), { ...defaultSettings(), ...parsed?.settings }, Boolean(parsed?.loggedIn))
  const save = () => localStorage.setItem(KEY, JSON.stringify({ state: app.state, settings: app.settings, loggedIn: app.loggedIn }))
  const done = () => { save(); return app.snapshot() }
  let listener: ((id: string) => void) | null = null

  return {
    platform: 'web',
    snapshot: async () => app.snapshot(),
    reload: async () => app.snapshot(),
    login: async (input) => { await app.login(input); return done() },
    logout: async () => { app.logout(); return done() },
    saveSetup: async (input) => { app.saveSetup(input); return done() },
    saveStudents: async (rows) => { const result = app.saveStudents(rows); save(); return result },
    loadHolidays: async () => { app.loadHolidays(); return done() },
    addOff: async (date, label) => { app.addOff(date, label); return done() },
    removeOff: async (date) => { app.removeOff(date); return done() },
    review: async (id) => { app.review(id); return done() },
    reject: async (id, reason) => { app.reject(id, reason); return done() },
    update: async (id, patch) => { app.update(id, patch); return done() },
    recalculate: async (ids) => { app.recalculate(ids); return done() },
    markPrinted: async (requestId, kind) => { app.markPrinted(requestId, kind); return done() },
    reportEvidenceUrls: async () => [],
    seed: async () => { app.seed(); return done() },
    simulate: async () => {
      const result = app.simulateIncoming()
      save()
      listener?.(result.requestId)
      return result
    },
    ack: async () => app.snapshot(),
    saveSettings: async (patch) => { app.saveSettings(patch); return done() },
    pickFolder: async () => app.snapshot(),
    openPath: async () => true,
    printPlan: async (input) => app.printPlan(input),
    generate: async ({ kind, requestId }) => {
      const bytes = await app.render({ template: await templateOf(kind), kind, requestId })
      const request = app.state.requests.find((item) => item.id === requestId)
      const student = app.state.students.find((item) => item.id === request?.studentId)
      const filename = kind === 'type2-3'
        ? `${app.state.classroom?.schoolYear ?? '학년도'}_색인목록표.hwpx`
        : `${(request?.startDate ?? '날짜').replaceAll('-', '')}_${String(student?.number ?? 0).padStart(2, '0')}_${student?.name ?? '학생'}_${documentFileLabel(kind)}.hwpx`
      download(bytes, filename)
      return { path: filename, filename }
    },
    printRun: async ({ items }) => {
      const files: string[] = []
      for (const item of items) {
        const bytes = await app.render({ template: await templateOf(item.kind), kind: item.kind, requestId: item.requestId })
        const request = app.state.requests.find((row) => row.id === item.requestId)
        const student = app.state.students.find((row) => row.id === request?.studentId)
        const filename = item.kind === 'type2-3'
          ? '색인목록표.hwpx'
          : `${request?.startDate ?? 'date'}_${student?.name ?? '학생'}_${item.kind}.hwpx`
        download(bytes, filename)
        files.push(filename)
      }
      return { files, note: '브라우저에서는 각 HWPX를 내려받습니다. 폴더 출력과 인쇄는 설치형 앱에서 합니다.' }
    },
    onOpenRequest: (callback) => {
      listener = callback
      return () => { if (listener === callback) listener = null }
    },
    onSnapshot: () => () => {},
  }
}
