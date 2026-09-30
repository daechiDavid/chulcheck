import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildIndexSection, countTables } from '../engine/hwpx/indexTable.ts'
import { readHwpx, textFile } from '../engine/hwpx/package.ts'
import { assertTemplateKeys } from '../engine/hwpx/validate.ts'
import { slotComments } from '../engine/hwpx/imageSlot.ts'
import type { IndexRow } from '../engine/placeholders.ts'

const templates = resolve('templates')

async function section(kind: string): Promise<string> {
  const bytes = await readFile(resolve(templates, `${kind}.hwpx`))
  return textFile(await readHwpx(bytes), 'Contents/section0.xml')
}

function row(no: number): IndexRow {
  return {
    no,
    studentId: 's',
    studentName: `학생${no}`,
    studentNumber: no,
    range: '26.04.06. ~ 04.08(3일)',
    place: '과학관 & 수목원',
    periodDays: 3,
    addpr: no,
    rptMark: no % 2 ? '○' : '',
    neisMark: '',
    overCumulative: no > 19,
    startDate: '2026-04-06',
  }
}

describe('templates and index pages', () => {
  it('보정 양식의 키가 계약과 같다', async () => {
    for (const kind of ['type1', 'type2-1', 'type2-2', 'type2-3']) {
      assertTemplateKeys(kind, await section(kind))
    }
  })

  it('서명 슬롯이 양식에 있다', async () => {
    for (const kind of ['type1', 'type2-1', 'type2-2']) {
      const comments = slotComments(await section(kind))
      expect(comments).toContain('SIG_PARENT')
      expect(comments).toContain('SIG_TEACHER')
    }
  })

  it.each([0, 1, 22, 23, 45])('%i건이면 22행 단위로 쪽을 만든다', async (count) => {
    const xml = buildIndexSection(await section('type2-3'), { schoolYear: '2026', grade: '3', class: '2' }, Array.from({ length: count }, (_, i) => row(i + 1)))
    const pages = Math.max(1, Math.ceil(count / 22))
    expect(countTables(xml)).toBe(pages)
    expect(xml.match(/<hp:secPr\b/g)?.length ?? 0).toBe(1)
    expect(xml).toContain('학생1'.replace('학생1', count ? '학생1' : '1'))
    if (count >= 23) expect(xml).toContain('>23<')
    if (count >= 45) expect(xml).toContain('>45<')
    expect(xml).not.toContain('{{')
    if (count > 0) expect(xml).toContain('과학관 &amp; 수목원')
    if (count === 0) expect(xml).toContain('>1<')
  })
})
