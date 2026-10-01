import type { RequestPatch, StudentInput } from '@engine/actions'
import type { DocKind } from '@engine/hwpx/generate'
import type { PrintItem } from '@engine/printSort'
import type { Settings, Snapshot } from '@engine/types'

export type DesktopApi = {
  platform: string
  snapshot: () => Promise<Snapshot>
  reload: () => Promise<Snapshot>
  login: (input: { email: string; password: string; name?: string; schoolName?: string }) => Promise<Snapshot>
  changeInitialPassword: (password: string) => Promise<Snapshot>
  logout: () => Promise<Snapshot>
  saveSetup: (input: { teacherName: string; schoolName: string; schoolYear: number; grade: number; classNo: number }) => Promise<Snapshot>
  saveStudents: (rows: StudentInput[]) => Promise<{ snapshot: Snapshot; inserted: number; updated: number; deactivated: number }>
  loadHolidays: () => Promise<Snapshot>
  addOff: (date: string, label: string) => Promise<Snapshot>
  removeOff: (date: string) => Promise<Snapshot>
  review: (id: string) => Promise<Snapshot>
  reject: (id: string, reason: string) => Promise<Snapshot>
  update: (id: string, patch: RequestPatch) => Promise<Snapshot>
  recalculate: (ids: string[]) => Promise<Snapshot>
  markPrinted: (requestId: string, kind: 'form' | 'report') => Promise<Snapshot>
  reportEvidenceUrls: (requestId: string) => Promise<Array<{ path: string; url: string }>>
  seed: () => Promise<Snapshot>
  simulate: () => Promise<{ snapshot: Snapshot; requestId: string; title: string }>
  ack: () => Promise<Snapshot>
  saveSettings: (patch: Partial<Settings>) => Promise<Snapshot>
  pickFolder: () => Promise<Snapshot>
  openPath: (path: string) => Promise<unknown>
  printPlan: (input: { requestIds?: string[]; unprintedOnly: boolean; includeIndex: boolean }) => Promise<PrintItem[]>
  generate: (input: { kind: DocKind; requestId?: string }) => Promise<{ path: string; filename: string }>
  printRun: (input: { items: Array<{ kind: DocKind; requestId?: string }> }) => Promise<{ files: string[]; note: string }>
  onOpenRequest: (callback: (id: string) => void) => () => void
  onSnapshot: (callback: (snap: Snapshot) => void) => () => void
}

type Bridge = {
  platform: string
  invoke: (action: string, payload?: unknown) => Promise<unknown>
  onOpenRequest: (callback: (id: string) => void) => () => void
  onSnapshot: (callback: (snap: Snapshot) => void) => () => void
}

declare global {
  interface Window {
    chulcheck?: Bridge
  }
}

function electronApi(bridge: Bridge): DesktopApi {
  const call = <T>(action: string, payload?: unknown) => bridge.invoke(action, payload) as Promise<T>
  return {
    platform: bridge.platform,
    snapshot: () => call('snapshot'),
    reload: () => call('reload'),
    login: (input) => call('login', input),
    changeInitialPassword: (password) => call('changeInitialPassword', { password }),
    logout: () => call('logout'),
    saveSetup: (input) => call('saveSetup', input),
    saveStudents: (rows) => call('saveStudents', { rows }),
    loadHolidays: () => call('loadHolidays'),
    addOff: (date, label) => call('addOff', { date, label }),
    removeOff: (date) => call('removeOff', { date }),
    review: (id) => call('review', { id }),
    reject: (id, reason) => call('reject', { id, reason }),
    update: (id, patch) => call('update', { id, patch }),
    recalculate: (ids) => call('recalculate', { ids }),
    markPrinted: (requestId, kind) => call('markPrinted', { requestId, kind }),
    reportEvidenceUrls: (requestId) => call('reportEvidenceUrls', { requestId }),
    seed: () => call('seed'),
    simulate: () => call('simulate'),
    ack: () => call('ack'),
    saveSettings: (patch) => call('saveSettings', patch),
    pickFolder: () => call('pickFolder'),
    openPath: (path) => call('openPath', { path }),
    printPlan: (input) => call('printPlan', input),
    generate: (input) => call('generate', input),
    printRun: (input) => call('printRun', input),
    onOpenRequest: (callback) => bridge.onOpenRequest(callback),
    onSnapshot: (callback) => bridge.onSnapshot(callback),
  }
}

export async function loadApi(): Promise<DesktopApi> {
  if (window.chulcheck) return electronApi(window.chulcheck)
  const { createBrowserApi } = await import('./browserApi')
  return createBrowserApi()
}
