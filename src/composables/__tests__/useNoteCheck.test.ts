import { describe, it, expect } from 'vitest'
import { isDuplicated, hasError, getValidatedOptions } from '../useNoteCheck'
import type { ExtendedNoteData } from '../../types'

function makeNote(overrides: Partial<ExtendedNoteData> = {}): ExtendedNoteData {
  return {
    index: 1,
    type: 1,
    lane: 1,
    measure: 0,
    position: 0,
    split: 8,
    option: [],
    end: [],
    ...overrides
  }
}

describe('isDuplicated', () => {
  it('重複するノートを検出できる', () => {
    const note = makeNote({ index: 2 })
    const chart = [makeNote({ index: 1 })]
    expect(isDuplicated(note, chart, [], { checkPreAppend: false })).toBe(1)
  })

  it('同じインデックスのノートは重複としない', () => {
    const note = makeNote({ index: 1 })
    const chart = [makeNote({ index: 1 })]
    expect(isDuplicated(note, chart, [], { checkPreAppend: false })).toBe(0)
  })

  it('テクスチャ(type:94)との重複は許容される', () => {
    const note = makeNote({ index: 2, type: 1 })
    const chart = [makeNote({ index: 1, type: 94 })]
    expect(isDuplicated(note, chart, [], { checkPreAppend: false })).toBe(0)
  })

  it('BPMとLEDが同位置でも重複としない', () => {
    const bpmNote = makeNote({ index: 2, type: 98 })
    const ledNote = makeNote({ index: 1, type: 96 })
    expect(isDuplicated(bpmNote, [ledNote], [], { checkPreAppend: false })).toBe(0)
  })

  it('仮配置ノートを含めて重複を検出できる', () => {
    const note = makeNote({ index: 2 })
    const preAppend = [makeNote({ index: 3 })]
    expect(isDuplicated(note, [], preAppend, { checkPreAppend: true })).toBe(1)
  })

  it('異なる小節のノートは重複としない', () => {
    const note = makeNote({ index: 2, measure: 0 })
    const chart = [makeNote({ index: 1, measure: 1 })]
    expect(isDuplicated(note, chart, [], { checkPreAppend: false })).toBe(0)
  })

  it('異なるレーンのノートは重複としない', () => {
    const note = makeNote({ index: 2, lane: 2 })
    const chart = [makeNote({ index: 1, lane: 1 })]
    expect(isDuplicated(note, chart, [], { checkPreAppend: false })).toBe(0)
  })
})

describe('hasError', () => {
  it('エラーのないノートは false を返す', () => {
    const note = makeNote()
    expect(hasError(note)).toBe(false)
  })

  it('splitが0のノートはエラーメッセージを返す', () => {
    const note = makeNote({ split: 0 })
    expect(hasError(note)).toBeTruthy()
  })

  it('不正なlaneのノートはエラーメッセージを返す', () => {
    const note = makeNote({ lane: 99 as any })
    expect(hasError(note)).toBeTruthy()
  })

  it('不正なtypeのノートはエラーメッセージを返す', () => {
    const note = makeNote({ type: 999 })
    expect(hasError(note)).toBeTruthy()
  })
})

describe('getValidatedOptions', () => {
  it('オプション配列をそのまま返す', () => {
    const note = makeNote({ option: ['3', '0', '4'] })
    const result = getValidatedOptions(note)
    expect(Array.isArray(result)).toBe(true)
  })
})
