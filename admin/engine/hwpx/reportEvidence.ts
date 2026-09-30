import type { HwpxFiles } from './package.ts'
import { setTextFile, textFile } from './package.ts'

const PIC_BLOCK = /<hp:pic\b[\s\S]*?<\/hp:pic>/g
const IMAGE_WIDTH = 20_000
const IMAGE_HEIGHT = 10_000

function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('보고서 증빙 사진이 JPEG 형식이 아닙니다.')
  }
  const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])
  let offset = 2
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1
    const marker = bytes[offset++]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (marker === 0xd9 || marker === 0xda) break
    if (offset + 1 >= bytes.length) break
    const length = (bytes[offset] << 8) | bytes[offset + 1]
    if (length < 2 || offset + length > bytes.length) break
    if (frameMarkers.has(marker)) {
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4]
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6]
      if (width && height) return { width, height }
      break
    }
    offset += length
  }
  throw new Error('보고서 증빙 사진 크기를 읽지 못했습니다.')
}

function pictureFrom(templatePic: string, index: number, width: number, height: number): string {
  const id = index + 3
  const instid = 1_000_000 + id
  const centerX = Math.round(width / 2)
  const centerY = Math.round(height / 2)
  return templatePic
    .replace(/<hp:pic\b([^>]*)>/, (_match, attrs: string) => `<hp:pic${attrs
      .replace(/\bid="\d+"/, `id="${id}"`)
      .replace(/\bzOrder="\d+"/, `zOrder="${id}"`)
      .replace(/\binstid="\d+"/, `instid="${instid}"`)}>`)
    .replace(/<hp:orgSz\b[^>]*\/>/, `<hp:orgSz width="${width}" height="${height}"/>`)
    .replace(/<hp:curSz\b[^>]*\/>/, `<hp:curSz width="${width}" height="${height}"/>`)
    .replace(/<hp:rotationInfo\b[^>]*\/>/, `<hp:rotationInfo angle="0" centerX="${centerX}" centerY="${centerY}" rotateimage="1"/>`)
    .replace(/<hp:imgRect>[\s\S]*?<\/hp:imgRect>/, `<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${width}" y="0"/><hc:pt2 x="${width}" y="${height}"/><hc:pt3 x="0" y="${height}"/></hp:imgRect>`)
    .replace(/<hp:imgClip\b[^>]*\/>/, `<hp:imgClip left="0" right="${width}" top="0" bottom="${height}"/>`)
    .replace(/<hp:imgDim\b[^>]*\/>/, `<hp:imgDim dimwidth="${width}" dimheight="${height}"/>`)
    .replace(/binaryItemIDRef="[^"]+"/, `binaryItemIDRef="reportEvidence${index + 1}"`)
    .replace(/<hp:sz\b[^>]*\/>/, `<hp:sz width="${width}" height="${height}" widthRelTo="ABSOLUTE" heightRelTo="ABSOLUTE" protect="0"/>`)
    .replace(/<hp:pos\b[^>]*\/>/, '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="1" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>')
    .replace(/<hp:shapeComment>[^<]*<\/hp:shapeComment>/, `<hp:shapeComment>REPORT_EVIDENCE_${index + 1}</hp:shapeComment>`)
}

function appendToReportCell(section: string, paragraphs: string): string {
  const address = '<hp:cellAddr colAddr="0" rowAddr="2"/>'
  const addressAt = section.indexOf(address)
  if (addressAt < 0) throw new Error('보고서 본문 칸을 찾지 못했습니다.')
  const cellStart = section.lastIndexOf('<hp:tc', addressAt)
  const subListStart = section.indexOf('<hp:subList', cellStart)
  const subListTagEnd = section.indexOf('>', subListStart)
  const subListEnd = section.indexOf('</hp:subList>', subListTagEnd)
  if (cellStart < 0 || subListStart < 0 || subListTagEnd < 0 || subListEnd < 0 || subListStart > addressAt) {
    throw new Error('보고서 본문 칸 구조를 확인하지 못했습니다.')
  }
  const subListTag = section.slice(subListStart, subListTagEnd + 1)
  if (!/\bvertAlign="[^"]+"/.test(subListTag)) throw new Error('보고서 본문 정렬 설정을 찾지 못했습니다.')
  const topAlignedTag = subListTag.replace(/\bvertAlign="[^"]+"/, 'vertAlign="TOP"')
  return `${section.slice(0, subListStart)}${topAlignedTag}${section.slice(subListTagEnd + 1, subListEnd)}${paragraphs}${section.slice(subListEnd)}`
}

export function appendReportEvidence(files: HwpxFiles, evidence: Uint8Array[]): void {
  if (evidence.length > 4) throw new Error('보고서 증빙 사진은 최대 4장까지 넣을 수 있습니다.')

  const sectionName = 'Contents/section0.xml'
  const headerName = 'Contents/header.xml'
  const contentName = 'Contents/content.hpf'
  const odfName = 'META-INF/manifest.xml'
  const section = textFile(files, sectionName)
  if (!evidence.length) {
    setTextFile(files, sectionName, appendToReportCell(section, ''))
    return
  }
  const header = textFile(files, headerName)
  const content = textFile(files, contentName)
  const odf = textFile(files, odfName)
  const templatePic = [...section.matchAll(PIC_BLOCK)].map((match) => match[0])
    .find((pic) => pic.includes('<hp:shapeComment>SIG_TEACHER</hp:shapeComment>'))
  if (!templatePic) throw new Error('보고서에 사진을 넣을 그림 형식을 찾지 못했습니다.')

  const headerEntries: string[] = []
  const contentEntries: string[] = []
  const odfEntries: string[] = []
  const paragraphs: string[] = []
  let binId = Number((header.match(/<hh:binData\b[^>]*\bid="(\d+)"/g) ?? []).map((tag) => Number(tag.match(/id="(\d+)"/)?.[1] ?? 0)).reduce((max, id) => Math.max(max, id), 0))
  for (let index = 0; index < evidence.length; index += 1) {
    const bytes = evidence[index]
    const source = jpegSize(bytes)
    const scale = Math.min(IMAGE_WIDTH / source.width, IMAGE_HEIGHT / source.height)
    const width = Math.max(1, Math.round(source.width * scale))
    const height = Math.max(1, Math.round(source.height * scale))
    const imageId = `reportEvidence${index + 1}`
    const href = `BinData/${imageId}.jpg`
    const paragraphStart = index % 2 === 0 ? '<hp:p id="2147483648" paraPrIDRef="13" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">' : ''
    const paragraphEnd = index % 2 === 1 || index === evidence.length - 1 ? '</hp:p>' : ''
    const photoGap = index % 2 === 0 && index + 1 < evidence.length ? '　' : ''
    paragraphs.push(`${paragraphStart}<hp:run charPrIDRef="14">${pictureFrom(templatePic, index, width, height)}<hp:t>${photoGap}</hp:t></hp:run>${paragraphEnd}`)
    files.set(href, bytes)
    binId += 1
    headerEntries.push(`<hh:binData id="${binId}" size="${bytes.length}" type="Embedding" storageItemIDRef="${imageId}"/>`)
    contentEntries.push(`<opf:item id="${imageId}" href="${href}" media-type="image/jpeg" isEmbeded="1"/>`)
    odfEntries.push(`<odf:file-entry odf:full-path="${href}" odf:media-type="image/jpeg"/>`)
  }

  const binList = header.match(/<hh:binDataList\b[^>]*>/)?.[0]
  if (!binList) throw new Error('HWPX 그림 목록을 찾지 못했습니다.')
  const itemCount = Number(binList.match(/itemCnt="(\d+)"/)?.[1] ?? 0) + headerEntries.length
  const updatedHeader = header
    .replace(/<hh:binDataList\b[^>]*>/, `<hh:binDataList itemCnt="${itemCount}">`)
    .replace('</hh:binDataList>', `${headerEntries.join('')}</hh:binDataList>`)
  const updatedContent = content.replace('</opf:manifest>', `${contentEntries.join('')}</opf:manifest>`)
  const updatedOdf = odf.replace('</odf:manifest>', `${odfEntries.join('')}</odf:manifest>`)
  setTextFile(files, headerName, updatedHeader)
  setTextFile(files, contentName, updatedContent)
  setTextFile(files, odfName, updatedOdf)
  setTextFile(files, sectionName, appendToReportCell(section, paragraphs.join('')))
}
