import { PNG } from 'pngjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cloneFiles, readHwpx, setTextFile, textFile, writeHwpx, type HwpxFiles } from '../engine/hwpx/package.ts'
import { extractPlaceholderKeys, stripLineseg } from '../engine/hwpx/fill.ts'
import { TYPE2_APP_KEYS } from '../engine/placeholders.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docs = resolve(root, '../docs')
const outDir = resolve(root, 'templates')

const WIDTH = 200
const HEIGHT = 100

function picRun(charPr: string, picId: number, instId: number, imageId: string, comment: string): string {
  const w = 5102
  const h = 2551
  return `<hp:run charPrIDRef="${charPr}"><hp:pic id="${picId}" zOrder="${picId}" numberingType="PICTURE" textWrap="IN_FRONT_OF_TEXT" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${instId}"><hp:offset x="0" y="0"/><hp:orgSz width="${w}" height="${h}"/><hp:curSz width="${w}" height="${h}"/><hp:flip horizontal="0" vertical="0"/><hp:rotationInfo angle="0" centerX="${Math.floor(w / 2)}" centerY="${Math.floor(h / 2)}" rotateimage="1"/><hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo><hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${w}" y="0"/><hc:pt2 x="${w}" y="${h}"/><hc:pt3 x="0" y="${h}"/></hp:imgRect><hp:imgClip left="0" right="${w}" top="0" bottom="${h}"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:imgDim dimwidth="${w}" dimheight="${h}"/><hc:img binaryItemIDRef="${imageId}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/><hp:effects/><hp:sz width="${w}" height="${h}" widthRelTo="ABSOLUTE" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="1" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:shapeComment>${comment}</hp:shapeComment></hp:pic><hp:t/></hp:run>`
}

function insertReportParent(xml: string, pic: string): string {
  // The supplied report anchors its floating signature in the student line,
  // so it overlaps the 인 in the following guardian line.
  const guardian = '{{aName}}  인'
  const at = xml.indexOf(guardian)
  if (at < 0 || xml.indexOf(guardian, at + guardian.length) >= 0) {
    throw new Error('type2-2 보호자 이름 위치를 찾지 못했습니다.')
  }
  const guardianStart = xml.lastIndexOf('<hp:p ', at)
  const guardianEnd = xml.indexOf('</hp:p>', at) + '</hp:p>'.length
  const studentStart = xml.lastIndexOf('<hp:p ', guardianStart - 1)
  const studentEnd = xml.indexOf('</hp:p>', studentStart) + '</hp:p>'.length
  if (guardianStart < 0 || guardianEnd < at || studentStart < 0 || studentEnd !== guardianStart) {
    throw new Error('type2-2 보호자 서명을 고정할 문단을 찾지 못했습니다.')
  }
  const student = xml.slice(studentStart, studentEnd)
  const guardianLine = xml.slice(guardianStart, guardianEnd)
  const runStart = '<hp:run charPrIDRef="10"><hp:t>'
  if (!student.includes('학  생  {{sName}}') || !student.includes(runStart) || student.includes('<hp:pic')) {
    throw new Error('type2-2 학생 이름 문단이 예상한 형태와 다릅니다.')
  }
  const picture = pic.match(/<hp:pic\b[\s\S]*?<\/hp:pic>/)?.[0]
  const position = picture?.match(/<hp:pos\b[^>]*\/>/)?.[0]
  if (!picture || !position) throw new Error('type2-2 보호자 서명 개체속성을 찾지 못했습니다.')
  const floatingPosition = position
    .replace('treatAsChar="1"', 'treatAsChar="0"')
    .replace('vertOffset="0"', 'vertOffset="1562"')
    .replace('horzOffset="0"', 'horzOffset="34423"')
  const floatingPicture = picture.replace(position, floatingPosition)
  const updatedStudent = student.replace(runStart, `<hp:run charPrIDRef="10">${floatingPicture}<hp:t>`)
  const updatedGuardian = guardianLine.replace(guardian, '{{aName}}     인')
  return xml.slice(0, studentStart) + updatedStudent + updatedGuardian + xml.slice(guardianEnd)
}

function insertType1Parent(xml: string, pic: string): string {
  // The supplied form anchors the floating signature in the blank paragraph
  // immediately above the guardian line, at these exact object offsets.
  const guardian = '{{name}}  (인)'
  const at = xml.indexOf(guardian)
  if (at < 0 || xml.indexOf(guardian, at + guardian.length) >= 0) {
    throw new Error('type1 보호자 이름 뒤의 두 칸과 (인)을 찾지 못했습니다.')
  }
  const paragraphStart = xml.lastIndexOf('<hp:p ', at)
  const paragraphEnd = xml.indexOf('</hp:p>', paragraphStart)
  const previousStart = xml.lastIndexOf('<hp:p ', paragraphStart - 1)
  const previousEnd = xml.indexOf('</hp:p>', previousStart) + '</hp:p>'.length
  if (paragraphStart < 0 || paragraphEnd < at || previousStart < 0 || previousEnd !== paragraphStart) {
    throw new Error('type1 보호자 서명을 고정할 문단을 찾지 못했습니다.')
  }
  const previous = xml.slice(previousStart, previousEnd)
  const emptyRun = '<hp:run charPrIDRef="10"/>'
  if (!previous.includes('paraPrIDRef="21"') || !previous.includes(emptyRun) || previous.includes('<hp:pic')) {
    throw new Error('type1 보호자 서명 문단이 예상한 빈 문단과 다릅니다.')
  }
  const position = pic.match(/<hp:pos\b[^>]*\/>/)?.[0]
  if (!position) throw new Error('type1 보호자 서명 개체속성을 찾지 못했습니다.')
  const floatingPosition = position
    .replace('treatAsChar="1"', 'treatAsChar="0"')
    .replace('vertOffset="0"', 'vertOffset="1003"')
    .replace('horzOffset="0"', 'horzOffset="40253"')
  const floatingPic = pic.replace(position, floatingPosition)
  const updated = previous.replace(emptyRun, floatingPic)
  return xml.slice(0, previousStart) + updated + xml.slice(previousEnd)
}

function normalizePeriodSpacing(xml: string): string {
  return xml.replace(/\(\s*(\{\{period\}\})\s*\)?\s*일간\s*\)?/g, '( $1일간 )')
}

function insertReportContentCell(xml: string): string {
  const address = '<hp:cellAddr colAddr="0" rowAddr="2"/>'
  const addressAt = xml.indexOf(address)
  if (addressAt < 0) throw new Error('보고서 체험 내용 칸을 찾지 못했습니다.')
  const cellStart = xml.lastIndexOf('<hp:tc', addressAt)
  const cellEnd = xml.indexOf('</hp:tc>', addressAt)
  if (cellStart < 0 || cellEnd < 0) throw new Error('보고서 체험 내용 칸의 범위를 찾지 못했습니다.')
  const cell = xml.slice(cellStart, cellEnd + '</hp:tc>'.length)
  const run = cell.match(/<hp:run charPrIDRef="(\d+)"\/>/)
  if (!run) throw new Error('보고서 체험 내용 자리표시자를 넣지 못했습니다.')
  const filledCell = cell.replace(run[0], `<hp:run charPrIDRef="${run[1]}"><hp:t>{{reason}}</hp:t></hp:run>`)
  return xml.slice(0, cellStart) + filledCell + xml.slice(cellEnd + '</hp:tc>'.length)
}

function insertTeacherCell(xml: string, pic: string): string {
  const at = xml.indexOf('전결')
  if (at < 0) throw new Error('담임 결재란을 찾지 못했습니다.')
  const slice = xml.slice(at, at + 4000)
  const match = slice.match(/<hp:run charPrIDRef="\d+"\/>/)
  if (!match || match.index == null) throw new Error('담임 서명 칸을 찾지 못했습니다.')
  const start = at + match.index
  return xml.slice(0, start) + pic + xml.slice(start + match[0].length)
}

function mustReplace(xml: string, pattern: RegExp, replacement: string, label: string): string {
  const next = xml.replace(pattern, replacement)
  if (next === xml) throw new Error(`연도 치환 실패: ${label}`)
  return next
}

function rewriteSection(kind: string, xml: string, parentPic: string, teacherPic: string): string {
  let next = xml
  if (kind === 'type1') {
    next = mustReplace(next, /2026년(\s*)\{\{sM\}\}/, '{{sY}}년$1{{sM}}', 'type1 시작 연도')
    next = mustReplace(next, /2026년(\s*)\{\{eM\}\}/, '{{eY}}년$1{{eM}}', 'type1 종료 연도')
    next = mustReplace(next, /2026년(\s*)\{\{M\}\}/, '{{yyyy}}년$1{{M}}', 'type1 제출 연도')
    next = insertType1Parent(next, parentPic)
    next = insertTeacherCell(next, teacherPic)
  }
  if (kind === 'type2-2') {
    next = mustReplace(next, /\{\{yyyy\}\}년(\s*)\{\{sM\}\}/, '{{sY}}년$1{{sM}}', 'type2-2 시작 연도')
    next = mustReplace(next, /\{\{yyyy\}\}년(\s*)\{\{eM\}\}/, '{{eY}}년$1{{eM}}', 'type2-2 종료 연도')
    next = insertReportContentCell(next)
    next = insertReportParent(next, parentPic)
    next = insertTeacherCell(next, teacherPic)
  }
  if (kind === 'type2-3') {
    next = next.replace('2026학년도', '{{schoolYear}}학년도')
    next = next.replace('{{yy.MM.dd. ~ MM.dd(period)}}', '{{range}}')
    next = next.replace('<hp:t>1</hp:t>', '<hp:t>{{no}}</hp:t>')
    next = next.replace('<hp:t>○</hp:t>', '<hp:t>{{rptMark}}</hp:t>')
    next = next.replace('<hp:t>○</hp:t>', '<hp:t>{{neisMark}}</hp:t>')
  }
  return stripLineseg(normalizePeriodSpacing(next))
}

function attachImages(header: string, manifest: string, odf: string, png: Uint8Array): { header: string; manifest: string; odf: string } {
  const size = png.length
  const bin = `<hh:binDataList itemCnt="2"><hh:binData id="1" size="${size}" type="Embedding" storageItemIDRef="image1"/><hh:binData id="2" size="${size}" type="Embedding" storageItemIDRef="image2"/></hh:binDataList>`
  const nextHeader = header
    .replace(/<hh:beginNum\b([^>]*?)\spic="\d+"/, '<hh:beginNum$1 pic="3"')
    .replace('</hh:head>', `${bin}</hh:head>`)
  const item = (id: string) => `<opf:item id="${id}" href="BinData/${id}.png" media-type="image/png" isEmbeded="1"/>`
  const nextManifest = manifest.replace('</opf:manifest>', `${item('image1')}${item('image2')}</opf:manifest>`)
  const nextOdf = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><odf:file-entry odf:full-path="BinData/image1.png" odf:media-type="image/png"/><odf:file-entry odf:full-path="BinData/image2.png" odf:media-type="image/png"/></odf:manifest>`
  return { header: nextHeader, manifest: nextManifest, odf: nextOdf || odf }
}

function validatePreparedType2Application(files: HwpxFiles): void {
  const section = textFile(files, 'Contents/section0.xml')
  const keys = new Set(extractPlaceholderKeys(section))
  if (keys.size !== TYPE2_APP_KEYS.length || TYPE2_APP_KEYS.some((key) => !keys.has(key))) {
    throw new Error('type2-1 양식의 자리표시자가 일치하지 않습니다.')
  }
  if (!section.includes('{{aName}}     인')) {
    throw new Error('type2-1 양식에서 보호자 이름과 인 사이의 다섯 칸을 찾지 못했습니다.')
  }

  const pics = [...section.matchAll(/<hp:pic\b[\s\S]*?<\/hp:pic>/g)].map((match) => match[0])
  for (const slot of ['SIG_PARENT', 'SIG_TEACHER']) {
    const matches = pics.filter((pic) => pic.includes(`<hp:shapeComment>${slot}</hp:shapeComment>`))
    if (matches.length !== 1 || !/<hp:pos\b[^>]*treatAsChar="0"/.test(matches[0])) {
      throw new Error(`type2-1 ${slot} 그림은 글자 위에 놓는 개체여야 합니다.`)
    }
  }
  const teacherAt = section.indexOf('<hp:shapeComment>SIG_TEACHER</hp:shapeComment>')
  const teacherCell = section.slice(section.lastIndexOf('<hp:tc', teacherAt), section.indexOf('</hp:tc>', teacherAt))
  if (!teacherCell.includes('<hp:cellSz width="6145" height="3836"/>')) {
    throw new Error('type2-1 교사 결재 칸의 고정 크기가 달라졌습니다.')
  }
  const firstParagraphEnd = teacherCell.indexOf('</hp:p>')
  if (teacherCell.indexOf('SIG_TEACHER') > firstParagraphEnd) {
    throw new Error('type2-1 교사 서명은 결재 칸의 첫 문단에 고정해야 합니다.')
  }
  const teacherPic = pics.find((pic) => pic.includes('<hp:shapeComment>SIG_TEACHER</hp:shapeComment>'))!
  const sizeTag = teacherPic.match(/<hp:sz\b[^>]*\/>/)?.[0] ?? ''
  const positionTag = teacherPic.match(/<hp:pos\b[^>]*\/>/)?.[0] ?? ''
  const marginTag = teacherCell.match(/<hp:cellMargin\b[^>]*\/>/)?.[0] ?? ''
  const numberAttr = (tag: string, name: string) => Number(tag.match(new RegExp(`(?:^|\\s)${name}="(\\d+)"`))?.[1] ?? NaN)
  const innerWidth = 6145 - numberAttr(marginTag, 'left') - numberAttr(marginTag, 'right')
  const innerHeight = 3836 - numberAttr(marginTag, 'top') - numberAttr(marginTag, 'bottom')
  const right = numberAttr(positionTag, 'horzOffset') + numberAttr(sizeTag, 'width')
  const bottom = numberAttr(positionTag, 'vertOffset') + numberAttr(sizeTag, 'height')
  if (![innerWidth, innerHeight, right, bottom].every(Number.isFinite) || right > innerWidth || bottom > innerHeight) {
    throw new Error('type2-1 교사 서명이 결재 칸 밖으로 나갑니다.')
  }

  const manifest = textFile(files, 'Contents/content.hpf')
  for (const imageId of ['image1', 'image2']) {
    const bytes = files.get(`BinData/${imageId}.png`)
    if (!bytes || !manifest.includes(`id="${imageId}"`)) throw new Error(`${imageId} 그림 자리가 없습니다.`)
    const png = PNG.sync.read(Buffer.from(bytes))
    if (png.width !== WIDTH || png.height !== HEIGHT) throw new Error(`${imageId} 그림 자리 크기가 다릅니다.`)
    for (let i = 3; i < png.data.length; i += 4) {
      if (png.data[i] !== 0) throw new Error(`${imageId} 그림 자리에 실제 서명이 남아 있습니다.`)
    }
  }
}

async function buildOne(kind: string): Promise<void> {
  const source = await readFile(resolve(docs, `${kind}.hwpx`))
  if (kind === 'type2-1') {
    // Preserve the supplied form's manually positioned signature objects and fixed approval cell.
    validatePreparedType2Application(await readHwpx(source))
    await mkdir(outDir, { recursive: true })
    await writeFile(resolve(outDir, `${kind}.hwpx`), source)
    console.log('wrote', kind, source.length)
    return
  }
  const files = cloneFiles(await readHwpx(source))
  const png = PNG.sync.write(new PNG({ width: WIDTH, height: HEIGHT }))
  const parentPic = picRun('10', 1, 1000001, 'image1', 'SIG_PARENT')
  const teacherPic = picRun('20', 2, 1000002, 'image2', 'SIG_TEACHER')
  const section = rewriteSection(kind, textFile(files, 'Contents/section0.xml'), parentPic, teacherPic)
  setTextFile(files, 'Contents/section0.xml', section)
  if (kind !== 'type2-3') {
    const attached = attachImages(
      textFile(files, 'Contents/header.xml'),
      textFile(files, 'Contents/content.hpf'),
      textFile(files, 'META-INF/manifest.xml'),
      png,
    )
    setTextFile(files, 'Contents/header.xml', attached.header)
    setTextFile(files, 'Contents/content.hpf', attached.manifest)
    setTextFile(files, 'META-INF/manifest.xml', attached.odf)
    files.set('BinData/image1.png', png)
    files.set('BinData/image2.png', png)
  }
  await mkdir(outDir, { recursive: true })
  const bytes = await writeHwpx(files)
  await writeFile(resolve(outDir, `${kind}.hwpx`), bytes)
  console.log('wrote', kind, bytes.length)
}

const kinds = ['type1', 'type2-1', 'type2-2', 'type2-3']
for (const kind of kinds) {
  await buildOne(kind)
}
