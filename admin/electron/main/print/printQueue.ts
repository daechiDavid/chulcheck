import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'

export type PdfJob = { src: string; pdf: string }

export function hwpScriptPath(appPath: string, resourcesPath: string, packaged: boolean): string {
  if (packaged) return path.join(resourcesPath, 'print', 'hwpCom.ps1')
  return path.join(appPath, 'electron/main/print/hwpCom.ps1')
}

export async function convertHwpxToPdf(scriptPath: string, files: PdfJob[]): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('한글 자동 변환은 Windows에서만 동작합니다.')
  }
  const jobPath = path.join(tmpdir(), `chulcheck-hwp-${Date.now()}.json`)
  await writeFile(jobPath, JSON.stringify({ files }), 'utf8')
  await new Promise<void>((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-JobPath', jobPath], {
      windowsHide: true,
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `한글 변환이 실패했습니다. (${code})`))
    })
  })
}

export async function printPdf(file: string, printer: string): Promise<void> {
  const require = createRequire(import.meta.url)
  const printerApi = require('pdf-to-printer') as { print: (pdf: string, options?: { printer?: string }) => Promise<void> }
  await printerApi.print(file, printer ? { printer } : undefined)
}

export async function mergePdfs(pdfPaths: string[], read: (file: string) => Promise<Uint8Array>, target: string): Promise<void> {
  const merged = await PDFDocument.create()
  for (const file of pdfPaths) {
    const doc = await PDFDocument.load(await read(file))
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach((page) => merged.addPage(page))
  }
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, await merged.save())
}
