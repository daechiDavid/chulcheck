import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, safeStorage, shell, Tray } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PNG } from 'pngjs'
import { LocalApp } from '@engine/app'
import { documentFileLabel } from '@engine/labels'
import type { DocKind } from '@engine/hwpx/generate'
import { defaultSettings, emptyState, type Settings } from '@engine/types'
import { RemoteApp, type StoredSession } from './data/remote'
import { readSupabaseEnv } from './data/supabaseRepo'
import { convertHwpxToPdf, hwpScriptPath, mergePdfs, printPdf, type PdfJob } from './print/printQueue'

type PersistedLocal = { state?: unknown; settings?: Settings; loggedIn?: boolean }
type PersistedRemote = { settings?: Settings; lastSeenAt?: string | null }

let tray: Tray | null = null
let win: BrowserWindow | null = null
let quitting = false
let unseen = 0
let desk: LocalApp | RemoteApp = new LocalApp()

function userFile(name: string): string {
  return path.join(app.getPath('userData'), name)
}

function templatesDir(): string {
  const candidates = [
    path.join(process.resourcesPath, 'templates'),
    path.join(app.getAppPath(), 'templates'),
    path.join(app.getAppPath(), '../../templates'),
  ]
  return candidates.find((dir) => existsSync(path.join(dir, 'type1.hwpx'))) ?? candidates[1]
}

async function loadPersisted(): Promise<void> {
  const env = readSupabaseEnv()
  if (env) {
    let settings = defaultSettings()
    let lastSeenAt: string | null = null
    try {
      const saved = JSON.parse(await readFile(userFile('remote-settings.json'), 'utf8')) as PersistedRemote
      settings = { ...defaultSettings(), ...saved.settings }
      lastSeenAt = saved.lastSeenAt ?? null
    } catch {
      settings = defaultSettings()
    }
    const session = await readSession()
    const remote = new RemoteApp({
      url: env.url,
      key: env.key,
      settings,
      lastSeenAt,
      onNotify: (title, requestId) => notify(title, requestId),
      onSnapshot: () => pushSnapshot(),
      onPersist: () => { void persist() },
      onSession: (next) => { void writeSession(next) },
    })
    desk = remote
    await remote.restore(session)
    return
  }
  try {
    const raw = await readFile(userFile('local-db.json'), 'utf8')
    const saved = JSON.parse(raw) as PersistedLocal
    if (saved.state && typeof saved.state === 'object') {
      desk = new LocalApp(saved.state as never, { ...defaultSettings(), ...saved.settings }, Boolean(saved.loggedIn))
      return
    }
  } catch {
    /* 처음 실행 */
  }
  desk = new LocalApp(emptyState(), defaultSettings(), false)
}

async function readSession(): Promise<StoredSession | null> {
  try {
    const raw = await readFile(userFile('session.bin'))
    if (!safeStorage.isEncryptionAvailable()) return null
    return JSON.parse(safeStorage.decryptString(raw)) as StoredSession
  } catch {
    return null
  }
}

async function writeSession(session: StoredSession | null): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  try { await unlink(userFile('session.json')) } catch { /* 이전 평문 파일 없음 */ }
  if (!session || !safeStorage.isEncryptionAvailable()) {
    try { await unlink(userFile('session.bin')) } catch { /* 이미 없음 */ }
    return
  }
  await writeFile(userFile('session.bin'), safeStorage.encryptString(JSON.stringify(session)))
}

async function persist(): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  if (desk instanceof RemoteApp) {
    await writeFile(userFile('remote-settings.json'), JSON.stringify({
      settings: desk.settings,
      lastSeenAt: desk.lastSeenAt,
    }))
    return
  }
  await writeFile(userFile('local-db.json'), JSON.stringify({
    state: desk.state,
    settings: desk.settings,
    loggedIn: desk.loggedIn,
  }))
}

function pushSnapshot(): void {
  if (!win || win.isDestroyed()) return
  win.webContents.send('snapshot', desk.snapshot())
}

function outputDir(): string {
  if (desk.settings.outputDir) return desk.settings.outputDir
  const year = desk.state.classroom?.schoolYear ?? new Date().getFullYear()
  return path.join(app.getPath('documents'), '출결서류', String(year))
}

async function readTemplate(kind: DocKind): Promise<Uint8Array> {
  return readFile(path.join(templatesDir(), `${kind}.hwpx`))
}

function fileBase(kind: DocKind, studentNumber?: number, studentName?: string, startDate?: string): string {
  if (kind === 'type2-3') return `${desk.state.classroom?.schoolYear ?? '학년도'}_색인목록표.hwpx`
  const day = (startDate ?? '날짜').replaceAll('-', '')
  const num = String(studentNumber ?? 0).padStart(2, '0')
  return `${day}_${num}_${studentName ?? '학생'}_${documentFileLabel(kind)}.hwpx`
}

function setBadge(): void {
  tray?.setToolTip(unseen ? `출석ON · 미확인 ${unseen}` : '출석ON')
  if (process.platform === 'darwin') tray?.setTitle(unseen ? String(unseen) : '')
}

function notify(title: string, requestId: string): void {
  unseen += 1
  setBadge()
  if (!Notification.isSupported()) return
  const notice = new Notification({ title: '출석ON', body: title })
  notice.on('click', () => {
    win?.show()
    win?.focus()
    win?.webContents.send('open-request', requestId)
  })
  notice.show()
}

async function dispatch(action: string, payload: Record<string, unknown> = {}): Promise<unknown> {
  switch (action) {
    case 'snapshot':
      return desk.snapshot()
    case 'reload':
      if (desk instanceof RemoteApp) return desk.reload()
      return desk.snapshot()
    case 'login':
      await desk.login(payload as { email: string; password: string; name?: string; schoolName?: string })
      await persist()
      return desk.snapshot()
    case 'changeInitialPassword':
      if (!(desk instanceof RemoteApp)) throw new Error('Supabase 계정에서만 비밀번호를 변경할 수 있습니다.')
      await desk.changeInitialPassword(String(payload.password ?? ''))
      await persist()
      return desk.snapshot()
    case 'logout':
      await desk.logout()
      await persist()
      return desk.snapshot()
    case 'saveSetup':
      await desk.saveSetup(payload as never)
      await persist()
      return desk.snapshot()
    case 'saveStudents': {
      const result = await desk.saveStudents(payload.rows as never)
      await persist()
      return result
    }
    case 'loadHolidays':
      await desk.loadHolidays()
      await persist()
      return desk.snapshot()
    case 'addOff':
      await desk.addOff(String(payload.date), String(payload.label ?? ''))
      await persist()
      return desk.snapshot()
    case 'removeOff':
      await desk.removeOff(String(payload.date))
      await persist()
      return desk.snapshot()
    case 'review':
      await desk.review(String(payload.id))
      await persist()
      return desk.snapshot()
    case 'reject':
      await desk.reject(String(payload.id), String(payload.reason ?? ''))
      await persist()
      return desk.snapshot()
    case 'update':
      await desk.update(String(payload.id), payload.patch as never)
      await persist()
      return desk.snapshot()
    case 'recalculate':
      await desk.recalculate((payload.ids as string[]) ?? [])
      await persist()
      return desk.snapshot()
    case 'markPrinted':
      await desk.markPrinted(String(payload.requestId), payload.kind === 'report' ? 'report' : 'form')
      await persist()
      return desk.snapshot()
    case 'reportEvidenceUrls':
      return desk instanceof RemoteApp ? desk.reportEvidenceUrls(String(payload.requestId)) : []
    case 'seed':
      await desk.seed()
      await persist()
      return desk.snapshot()
    case 'simulate': {
      const result = await desk.simulateIncoming()
      await persist()
      notify(result.title, result.requestId)
      return result
    }
    case 'ack':
      unseen = Math.max(0, unseen - 1)
      setBadge()
      return desk.snapshot()
    case 'saveSettings': {
      const patch = payload as Partial<Settings>
      desk.saveSettings(patch)
      if (typeof patch.openAtLogin === 'boolean') app.setLoginItemSettings({ openAtLogin: patch.openAtLogin })
      await persist()
      return desk.snapshot()
    }
    case 'pickFolder': {
      const picked = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
      if (picked.canceled || !picked.filePaths[0]) return desk.snapshot()
      desk.saveSettings({ outputDir: picked.filePaths[0] })
      await persist()
      return desk.snapshot()
    }
    case 'openPath':
      await shell.openPath(String(payload.path ?? ''))
      return true
    case 'printPlan':
      return desk.printPlan({
        requestIds: payload.requestIds as string[] | undefined,
        unprintedOnly: Boolean(payload.unprintedOnly),
        includeIndex: Boolean(payload.includeIndex),
      })
    case 'generate':
      return writeDocument(String(payload.kind) as DocKind, payload.requestId ? String(payload.requestId) : undefined)
    case 'printRun':
      return runPrint((payload.items as Array<{ kind: DocKind; requestId?: string }>) ?? [])
    default:
      throw new Error(`알 수 없는 요청: ${action}`)
  }
}

async function writeDocument(kind: DocKind, requestId?: string): Promise<{ path: string; filename: string }> {
  if (desk instanceof RemoteApp) {
    await desk.reload()
    if (desk.loadError) throw new Error(desk.loadError)
  }
  const request = requestId ? desk.state.requests.find((item) => item.id === requestId) : undefined
  if (request && (request.status === 'cancelled' || request.status === 'rejected')) {
    throw new Error('취소·반려된 건은 만들지 않습니다.')
  }
  const student = request ? desk.state.students.find((item) => item.id === request.studentId) : undefined
  const bytes = await desk.render({ template: await readTemplate(kind), kind, requestId })
  const filename = fileBase(kind, student?.number, student?.name, request?.startDate)
  const dir = outputDir()
  await mkdir(dir, { recursive: true })
  const target = path.join(dir, filename)
  await writeFile(target, bytes)
  return { path: target, filename }
}

async function runPrint(items: Array<{ kind: DocKind; requestId?: string }>): Promise<{ files: string[]; note: string }> {
  const files: string[] = []
  const skipped: string[] = []
  for (const item of items) {
    if (item.requestId) {
      const request = desk.state.requests.find((row) => row.id === item.requestId)
      if (!request || request.status === 'cancelled' || request.status === 'rejected') {
        skipped.push(item.requestId)
        continue
      }
    }
    const written = await writeDocument(item.kind, item.requestId)
    files.push(written.path)
  }
  if (!files.length) throw new Error(skipped.length ? '출력 직전에 취소·반려되어 넘긴 건만 남았습니다.' : '출력할 문서가 없습니다.')
  const dir = path.dirname(files[0])
  if (process.platform === 'win32') {
    try {
      const jobs: PdfJob[] = files.map((src) => ({ src, pdf: src.replace(/\.hwpx$/i, '.pdf') }))
      await convertHwpxToPdf(hwpScriptPath(app.getAppPath(), process.resourcesPath, app.isPackaged), jobs)
      const merged = path.join(dir, `일괄_${Date.now()}.pdf`)
      await mergePdfs(jobs.map((job) => job.pdf), (file) => readFile(file), merged)
      let note = 'PDF로 합쳤습니다.'
      try {
        await printPdf(merged, desk.settings.printer)
        note = '프린터로 보냈습니다. 출력됨으로 표시하면 대장에 기록됩니다.'
      } catch {
        note = 'PDF는 만들었습니다. pdf-to-printer가 없으면 폴더에서 직접 인쇄하세요.'
        await shell.openPath(merged)
      }
      return { files, note: skipped.length ? `${note} 제외 ${skipped.length}건.` : note }
    } catch (error) {
      await shell.openPath(dir)
      const message = error instanceof Error ? error.message : '한글 변환에 실패했습니다.'
      return { files, note: `${message} HWPX를 폴더에 저장했습니다.` }
    }
  }
  shell.showItemInFolder(files[0])
  return {
    files,
    note: `macOS에서는 문서를 만들고 폴더를 엽니다. 한글 인쇄와 출력 시각 기록은 Windows에서 합니다.${skipped.length ? ` 제외 ${skipped.length}건.` : ''}`,
  }
}

function trayImage() {
  const png = new PNG({ width: 16, height: 16 })
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const dx = x - 7.5
      const dy = y - 7.5
      const inside = dx * dx + dy * dy < 42
      const i = (y * 16 + x) << 2
      png.data[i] = inside ? 158 : 0
      png.data[i + 1] = inside ? 43 : 0
      png.data[i + 2] = inside ? 43 : 0
      png.data[i + 3] = inside ? 255 : 0
    }
  }
  return nativeImage.createFromBuffer(PNG.sync.write(png))
}

function appIconPath(): string | undefined {
  const candidates = [
    path.join(process.resourcesPath, 'icon.png'),
    path.join(app.getAppPath(), 'build/icon.png'),
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

export async function startApp(): Promise<void> {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return
  }
  app.on('second-instance', () => {
    win?.show()
    win?.focus()
  })
  await app.whenReady()
  const icon = appIconPath()
  if (icon) app.dock?.setIcon(icon)
  try {
    await loadPersisted()
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : String(error)
    dialog.showErrorBox('출석ON', `서버 연결을 준비하지 못했습니다.\n${message}`)
    app.exit(1)
    return
  }
  ipcMain.handle('chulcheck', (_event, action: string, payload?: Record<string, unknown>) => dispatch(action, payload))
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 680,
    title: '출석ON',
    icon,
    backgroundColor: '#f3efe4',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  win.once('ready-to-show', () => win?.show())
  win.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    win?.hide()
  })
  tray = new Tray(trayImage())
  tray.setToolTip('출석ON')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '열기', click: () => { win?.show(); win?.focus() } },
    { label: '종료', click: () => { quitting = true; app.quit() } },
  ]))
  tray.on('click', () => { win?.show(); win?.focus() })
  if (process.env.ELECTRON_RENDERER_URL) await win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await win.loadFile(path.join(__dirname, '../renderer/index.html'))
  app.on('activate', () => { win?.show() })
  app.on('before-quit', () => { quitting = true })
}
