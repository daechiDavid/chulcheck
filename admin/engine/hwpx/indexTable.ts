import { DOMParser, XMLSerializer, type Element as XmlElement, type Document as XmlDocument } from '@xmldom/xmldom'
import type { IndexRow, PlaceholderMap } from '../placeholders.ts'
import { stripLineseg } from './fill.ts'

const PAGE_ROWS = 22

function elements(parent: XmlElement | XmlDocument, local: string): XmlElement[] {
  const out: XmlElement[] = []
  const nodes = parent.childNodes
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (node.nodeType === 1 && (node as XmlElement).localName === local) out.push(node as XmlElement)
  }
  return out
}

function descendants(root: XmlElement, local: string): XmlElement[] {
  const out: XmlElement[] = []
  const walk = (node: XmlElement) => {
    const children = node.childNodes
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i]
      if (child.nodeType !== 1) continue
      const el = child as XmlElement
      if (el.localName === local) out.push(el)
      walk(el)
    }
  }
  walk(root)
  return out
}

function textOf(el: XmlElement): string {
  return descendants(el, 't')
    .map((node) => node.textContent ?? '')
    .join('')
}

function rowAddr(row: XmlElement): number {
  const addr = descendants(row, 'cellAddr')[0]
  return Number(addr?.getAttribute('rowAddr') ?? '0')
}

function setRowAddr(row: XmlElement, addr: number): void {
  for (const cellAddr of descendants(row, 'cellAddr')) cellAddr.setAttribute('rowAddr', String(addr))
}

function fillRow(row: XmlElement, values: Record<string, string>): void {
  for (const node of descendants(row, 't')) {
    const current = node.textContent ?? ''
    if (!current.includes('{{')) continue
    node.textContent = current.replace(/\{\{([^}]+)\}\}/g, (_token, key: string) => {
      const value = values[key]
      if (value == null) throw new Error(`목록표에 없는 항목: ${key}`)
      return value
    })
  }
}

function applyHeader(doc: XmlDocument, header: PlaceholderMap): void {
  for (const node of descendants(doc.documentElement!, 't')) {
    const current = node.textContent ?? ''
    if (!current.includes('{{')) continue
    if (current.includes('{{no}}') || current.includes('{{sName}}') || current.includes('{{range}}')) continue
    node.textContent = current.replace(/\{\{([^}]+)\}\}/g, (token, key: string) => {
      if (!(key in header)) return token
      return header[key] ?? ''
    })
  }
}

export function buildIndexSection(sectionXml: string, header: PlaceholderMap, rows: IndexRow[]): string {
  const doc = new DOMParser().parseFromString(sectionXml, 'application/xml')
  const root = doc.documentElement
  if (!root || root.localName === 'parsererror') throw new Error('목록표 양식 XML을 읽지 못했습니다.')
  const table = descendants(root, 'tbl')[0]
  if (!table) throw new Error('목록표 표를 찾지 못했습니다.')
  const template = elements(table, 'tr').find((row) => textOf(row).includes('{{sName}}') || textOf(row).includes('{{no}}'))
  if (!template) throw new Error('목록표 행 틀을 찾지 못했습니다.')

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_ROWS))
  const pageNodes = elements(root, 'p')
  for (const node of pageNodes) root.removeChild(node)

  for (let page = 0; page < pageCount; page += 1) {
    const clones = pageNodes.map((node) => node.cloneNode(true) as XmlElement)
    if (page > 0) {
      clones[0]?.setAttribute('pageBreak', '1')
      for (const secPr of descendants(clones[0], 'secPr')) secPr.parentNode?.removeChild(secPr)
      const clonedTable = descendants(clones[2] ?? clones[0], 'tbl')[0]
      if (clonedTable) {
        const nextId = String(1_500_000_000 + page)
        clonedTable.setAttribute('id', nextId)
      }
    }
    const pageTable = descendants(clones.find((node) => descendants(node, 'tbl').length) ?? clones[0], 'tbl')[0]
    if (!pageTable) throw new Error('복제한 쪽에서 표를 찾지 못했습니다.')
    const pageTemplate = elements(pageTable, 'tr').find((row) => textOf(row).includes('{{sName}}') || textOf(row).includes('{{no}}'))
    if (!pageTemplate) throw new Error('복제 쪽에 행 틀이 없습니다.')
    for (const row of elements(pageTable, 'tr')) {
      if (rowAddr(row) >= 2) pageTable.removeChild(row)
    }
    for (let slot = 0; slot < PAGE_ROWS; slot += 1) {
      const row = pageTemplate.cloneNode(true) as XmlElement
      setRowAddr(row, 2 + slot)
      const item = rows[page * PAGE_ROWS + slot]
      const number = String(page * PAGE_ROWS + slot + 1)
      if (item) {
        fillRow(row, {
          no: number,
          sName: item.studentName,
          range: item.range,
          place: item.place,
          rptMark: item.rptMark,
          neisMark: item.neisMark,
          addpr: String(item.addpr),
        })
      } else {
        fillRow(row, { no: number, sName: '', range: '', place: '', rptMark: '', neisMark: '', addpr: '' })
      }
      pageTable.appendChild(row)
    }
    pageTable.setAttribute('rowCnt', String(2 + PAGE_ROWS))
    for (const node of clones) root.appendChild(node)
  }

  applyHeader(doc, header)
  const serialized = new XMLSerializer().serializeToString(doc)
  const stripped = stripLineseg(serialized)
  const left = stripped.match(/\{\{([^}]+)\}\}/g)
  if (left?.length) throw new Error(`목록표에 남은 항목: ${left.join(', ')}`)
  const body = stripped.startsWith('<?xml') ? stripped : `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>${stripped}`
  return body
}

export function countTables(xml: string): number {
  return xml.match(/<hp:tbl\b/g)?.length ?? 0
}
