import { describe, expect, it } from 'vitest'
import { periodDays } from '../engine/period.ts'

describe('periodDays', () => {
  it('평일 3일 연속은 3', () => {
    expect(periodDays('2026-09-28', '2026-09-30')).toBe(3)
  })

  it('금~월은 주말을 빼서 2', () => {
    expect(periodDays('2026-09-25', '2026-09-28')).toBe(2)
  })

  it('공휴일을 제외한다', () => {
    expect(periodDays('2026-09-28', '2026-09-30', ['2026-09-29'])).toBe(2)
  })

  it('재량휴업일을 제외한다', () => {
    expect(periodDays('2026-10-05', '2026-10-07', ['2026-10-06'])).toBe(2)
  })

  it('연도를 넘겨 센다', () => {
    expect(periodDays('2026-12-30', '2027-01-02', ['2027-01-01'])).toBe(2)
  })
})
