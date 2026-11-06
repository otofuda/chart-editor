import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readLegacyNumber, usePersistedRef, writeLegacyNumber } from '../usePersistedRef'

describe('usePersistedRef', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('初期値を使い、変更を即時保存して再作成時に復元する', () => {
    const enabled = usePersistedRef('enabled', false)
    const volume = usePersistedRef('volume', 100, { min: 0, max: 100 })

    expect(enabled.value).toBe(false)
    expect(volume.value).toBe(100)
    enabled.value = true
    volume.value = 0

    expect(localStorage.getItem('enabled')).toBe('true')
    expect(localStorage.getItem('volume')).toBe('0')
    expect(usePersistedRef('enabled', false).value).toBe(true)
    expect(usePersistedRef('volume', 100, { min: 0, max: 100 }).value).toBe(0)
    enabled.value = false
    expect(usePersistedRef('enabled', true).value).toBe(false)
  })

  it.each(['garbage', '', 'null', '"true"', '1', '{}'])('不正な真偽値 %s は初期値を使う', stored => {
    localStorage.setItem('enabled', stored)
    expect(usePersistedRef('enabled', false).value).toBe(false)
  })

  it.each(['garbage', '', 'null', '"0"', 'true', '101', '-1', '1e999'])(
    '不正な数値 %s は初期値を使う',
    stored => {
      localStorage.setItem('volume', stored)
      expect(usePersistedRef('volume', 50, { min: 0, max: 100 }).value).toBe(50)
    },
  )

  it('入力途中の不正な値は保存せず、続く有効な値を保存する', () => {
    const value = usePersistedRef('value', 10, { min: 0, max: 100 })
    value.value = 25
    for (const invalid of ['', '-', NaN, Infinity, -1, 101]) {
      value.value = invalid as number
      expect(localStorage.getItem('value')).toBe('25')
    }
    value.value = 0
    expect(localStorage.getItem('value')).toBe('0')
  })

  it('保存領域が利用できなくても初期化と変更ができる', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('unavailable')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('unavailable')
    })

    const value = usePersistedRef('value', false)
    expect(value.value).toBe(false)
    expect(() => {
      value.value = true
    }).not.toThrow()
    expect(value.value).toBe(true)
    expect(readLegacyNumber('old', 100)).toBe(100)
    expect(() => writeLegacyNumber('old', 50)).not.toThrow()
  })
})
