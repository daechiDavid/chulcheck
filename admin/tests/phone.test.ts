import { describe, expect, it } from 'vitest'
import { phoneForUpsert } from '../electron/main/data/remote'

describe('phoneForUpsert', () => {
  it('keeps an existing last4 display from being hashed again', () => {
    expect(phoneForUpsert('1234')).toBeNull()
    expect(phoneForUpsert('')).toBeNull()
  })

  it('sends a full number through', () => {
    expect(phoneForUpsert('010-1234-5678')).toBe('010-1234-5678')
  })
})