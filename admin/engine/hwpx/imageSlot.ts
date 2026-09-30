import { textFile } from './package.ts'
import type { HwpxFiles } from './package.ts'

export type SlotName = 'SIG_PARENT' | 'SIG_TEACHER'

const PIC_BLOCK = /<hp:pic\b[\s\S]*?<\/hp:pic>/g

async function loadPng() {
  const mod = await import('pngjs')
  return mod.PNG
}

export async function transparentPng(width: number, height: number): Promise<Uint8Array> {
  const PNG = await loadPng()
  return PNG.sync.write(new PNG({ width, height }))
}

export async function aspectFitPng(signature: Uint8Array, slotWidth: number, slotHeight: number): Promise<Uint8Array> {
  const PNG = await loadPng()
  const src = PNG.sync.read(Buffer.from(signature))
  const out = new PNG({ width: slotWidth, height: slotHeight })
  if (src.width < 1 || src.height < 1) return PNG.sync.write(out)
  const scale = Math.min(slotWidth / src.width, slotHeight / src.height)
  const dw = Math.max(1, Math.round(src.width * scale))
  const dh = Math.max(1, Math.round(src.height * scale))
  const ox = Math.floor((slotWidth - dw) / 2)
  const oy = Math.floor((slotHeight - dh) / 2)
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const sx = Math.min(src.width - 1, Math.floor(x / scale))
      const sy = Math.min(src.height - 1, Math.floor(y / scale))
      const si = (sy * src.width + sx) << 2
      const di = ((oy + y) * slotWidth + (ox + x)) << 2
      out.data[di] = src.data[si]
      out.data[di + 1] = src.data[si + 1]
      out.data[di + 2] = src.data[si + 2]
      out.data[di + 3] = src.data[si + 3]
    }
  }
  return PNG.sync.write(out)
}

export async function pngSize(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  const PNG = await loadPng()
  const png = PNG.sync.read(Buffer.from(bytes))
  return { width: png.width, height: png.height }
}

function manifestHref(contentHpf: string, itemId: string): string | null {
  const pattern = new RegExp(`<opf:item\\b[^>]*id="${itemId}"[^>]*>`, 'i')
  const tag = contentHpf.match(pattern)?.[0]
  if (!tag) return null
  return tag.match(/href="([^"]+)"/)?.[1] ?? null
}

export async function replaceImageSlots(
  files: HwpxFiles,
  images: Partial<Record<SlotName, Uint8Array | null>>,
): Promise<void> {
  const sectionName = 'Contents/section0.xml'
  const section = textFile(files, sectionName)
  const manifest = textFile(files, 'Contents/content.hpf')
  const used = new Map<SlotName, string>()

  for (const match of section.matchAll(PIC_BLOCK)) {
    const block = match[0]
    const comment = block.match(/<hp:shapeComment>([^<]*)<\/hp:shapeComment>/)?.[1] as SlotName | undefined
    if (comment !== 'SIG_PARENT' && comment !== 'SIG_TEACHER') continue
    const ref = block.match(/binaryItemIDRef="([^"]+)"/)?.[1]
    if (!ref) throw new Error(`${comment} 슬롯의 이미지 참조가 없습니다.`)
    const href = manifestHref(manifest, ref)
    if (!href) throw new Error(`${ref} 항목을 content.hpf에서 찾지 못했습니다.`)
    if (used.has(comment)) throw new Error(`${comment} 슬롯이 둘 이상입니다.`)
    used.set(comment, href)
  }

  for (const slot of ['SIG_PARENT', 'SIG_TEACHER'] as SlotName[]) {
    const href = used.get(slot)
    if (!href) continue
    const current = files.get(href)
    const size = current ? await pngSize(current) : { width: 200, height: 100 }
    const source = images[slot]
    const next = source && source.length ? await aspectFitPng(source, size.width, size.height) : await transparentPng(size.width, size.height)
    files.set(href, next)
    const headerName = 'Contents/header.xml'
    if (files.has(headerName)) {
      const header = textFile(files, headerName)
      const updated = header.replace(
        new RegExp(`(<hh:binData\\b[^>]*storageItemIDRef="${href.includes('image') ? manifestId(manifest, href) : ''}"[^>]*size=")(\\d+)`),
        `$1${next.length}`,
      )
      if (updated !== header) setIfChanged(files, headerName, updated)
    }
  }
}

function manifestId(manifest: string, href: string): string {
  const tags = manifest.match(/<opf:item\b[^>]*>/g) ?? []
  for (const tag of tags) {
    if (tag.includes(`href="${href}"`)) return tag.match(/id="([^"]+)"/)?.[1] ?? ''
  }
  return ''
}

function setIfChanged(files: HwpxFiles, name: string, xml: string): void {
  files.set(name, new TextEncoder().encode(xml))
}

export function slotComments(xml: string): string[] {
  return [...xml.matchAll(PIC_BLOCK)]
    .map((match) => match[0].match(/<hp:shapeComment>([^<]*)<\/hp:shapeComment>/)?.[1] ?? '')
    .filter(Boolean)
}
