import JSZip from 'jszip'

export type HwpxFiles = Map<string, Uint8Array>

export async function readHwpx(data: Uint8Array | ArrayBuffer): Promise<HwpxFiles> {
  const zip = await JSZip.loadAsync(data)
  const files: HwpxFiles = new Map()
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir)
  for (const name of names) {
    files.set(name, await zip.files[name].async('uint8array'))
  }
  return files
}

export async function writeHwpx(files: HwpxFiles): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' })
  const names = [...files.keys()].filter((name) => name !== 'mimetype').sort()
  for (const name of names) {
    zip.file(name, files.get(name)!)
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}

export function textFile(files: HwpxFiles, name: string): string {
  const bytes = files.get(name)
  if (!bytes) throw new Error(`HWPX에 ${name}이 없습니다.`)
  return new TextDecoder('utf-8').decode(bytes)
}

export function setTextFile(files: HwpxFiles, name: string, xml: string): void {
  files.set(name, new TextEncoder().encode(xml))
}

export function cloneFiles(files: HwpxFiles): HwpxFiles {
  return new Map([...files].map(([name, bytes]) => [name, bytes.slice()]))
}
