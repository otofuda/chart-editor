import { describe, it, expect } from 'vitest'
import { isDuplicated, hasError, getValidatedOptions, getValidatedNote } from '../useNoteCheck'
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

  it('小数のレーン位置(1.5や0.0, 6.0)を許容する', () => {
    expect(hasError(makeNote({ lane: 1.5 as any }))).toBe(false)
    expect(hasError(makeNote({ lane: 0.0 as any }))).toBe(false)
    expect(hasError(makeNote({ lane: 6.0 as any }))).toBe(false)
    expect(hasError(makeNote({ lane: -1 }))).toBe(false)
  })

  it('splitが0のノートはエラーメッセージを返す', () => {
    const note = makeNote({ split: 0 })
    expect(hasError(note)).toBeTruthy()
  })

  it('不正なlaneのノートはエラーメッセージを返す', () => {
    expect(hasError(makeNote({ lane: 99 as any }))).toBeTruthy()
    expect(hasError(makeNote({ lane: -2 as any }))).toBeTruthy()
    expect(hasError(makeNote({ lane: 6.1 as any }))).toBeTruthy()
  })

  it('type 89 (中点 / 終端なし) を許容する', () => {
    expect(hasError(makeNote({ type: 89 }))).toBe(false)
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

  it('type 2 (ロング始点) の speed / orbit オプションを保持する', () => {
    const note = makeNote({ type: 2, option: ['1.5', 'spiral'] })
    const result = getValidatedOptions(note)
    expect(result).toEqual(['1.5', 'spiral'])
  })

  it('type 1 / 89 の曲線オプション [speed, orbit, curve] を保持する', () => {
    const note = makeNote({ type: 1, option: ['', '', 'ease'] })
    const result = getValidatedOptions(note)
    expect(result).toEqual(['', '', 'ease'])
  })

  it('type 1 / 89 で末尾のデフォルト曲線 (linear) や空文字を切り詰める', () => {
    const note = makeNote({ type: 89, option: ['1.5', '', 'linear'] })
    const result = getValidatedOptions(note)
    expect(result).toEqual(['1.5'])
  })
})

describe('getValidatedNote', () => {
  it('ネストした終点を再帰的に保持する', () => {
    const nestedLN: ExtendedNoteData = makeNote({
      type: 2,
      lane: 1,
      end: [
        makeNote({
          type: 1,
          lane: 3,
          option: ['', '', 'ease'],
          end: [
            makeNote({
              type: 89,
              lane: 5,
              option: ['', '', 'easeIn'],
              end: [],
            }),
          ],
        }),
      ],
    })

    const validated = getValidatedNote(nestedLN)
    expect(validated.end.length).toBe(1)
    expect(validated.end[0].lane).toBe(3)
    expect(validated.end[0].option).toEqual(['', '', 'ease'])
    expect(validated.end[0].end.length).toBe(1)
    expect(validated.end[0].end[0].lane).toBe(5)
    expect(validated.end[0].end[0].option).toEqual(['', '', 'easeIn'])
  })
})
