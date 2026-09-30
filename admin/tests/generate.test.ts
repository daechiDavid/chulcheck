import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LocalApp } from '../engine/app.ts'
import { readHwpx, textFile } from '../engine/hwpx/package.ts'

describe('render type1', () => {
  it('샘플 신청으로 결석신고서를 만들고 남은 칸이 없다', async () => {
    const app = new LocalApp()
    await app.login({ email: 'teacher@school.test', password: 'secret', name: '김담임', schoolName: '한빛초' })
    app.saveSetup({ teacherName: '김담임', schoolName: '한빛초', schoolYear: 2026, grade: 3, classNo: 2 })
    app.seed()
    const request = app.state.requests.find((item) => item.docType === 'type1' && item.category === 6) ?? app.state.requests.find((item) => item.docType === 'type1')
    expect(request).toBeTruthy()
    const template = await readFile(resolve('templates/type1.hwpx'))
    const bytes = await app.render({ template, kind: 'type1', requestId: request!.id })
    const section = textFile(await readHwpx(bytes), 'Contents/section0.xml')
    expect(section).not.toContain('{{')
    expect(section).toContain('홍길동')
    expect(section).toContain('■')
    expect(section).toContain('SIG_PARENT')
  })
})
