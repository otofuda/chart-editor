import { describe, it, expect } from 'vitest'
import { noteTypes, noteOptions } from '../useNoteTypes'
import type { NoteData } from 'chart-types'

describe('noteTypes', () => {
  it('ノートタイプの配列が存在する', () => {
    expect(noteTypes).toBeDefined()
    expect(noteTypes.length).toBeGreaterThan(0)
  })

  it('各ノートタイプに title と value が含まれる', () => {
    for (const t of noteTypes) {
      expect(typeof t.title).toBe('string')
      expect(typeof t.value).toBe('number')
    }
  })

  it('通常ノート(type:1)が含まれる', () => {
    const tap = noteTypes.find(t => t.value === 1)
    expect(tap).toBeDefined()
  })
})

describe('noteOptions', () => {
  const baseNote: NoteData = { type: 1, lane: 1, measure: 0, position: 0, split: 8, option: [], end: [] }

  it('未定義のノートタイプはオプション空配列を返す', () => {
    const result = noteOptions({ ...baseNote, type: 1 })
    expect(Array.isArray(result)).toBe(true)
  })

  it('テクスチャ(type:94)は複数のオプションを返す', () => {
    const result = noteOptions({ ...baseNote, type: 94 })
    expect(result.length).toBeGreaterThan(0)
  })

  it('BPM変化(type:98)はBPMオプションを返す', () => {
    const result = noteOptions({ ...baseNote, type: 98 })
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].label).toBeDefined()
  })
})
