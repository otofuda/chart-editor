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
  })

  it('レーン非使用ノート(type: 98, 96等)は lane: -1 を要求する', () => {
    expect(hasError(makeNote({ type: 98, lane: -1 }))).toBe(false)
    expect(hasError(makeNote({ type: 98, lane: 1 }))).toBeTruthy()
    expect(hasError(makeNote({ type: 96, lane: -1 }))).toBe(false)
    expect(hasError(makeNote({ type: 96, lane: 2 }))).toBeTruthy()
  })

  it('音札ノート(type: 5)は lane: 3 を要求する', () => {
    expect(hasError(makeNote({ type: 5, lane: 3 }))).toBe(false)
    expect(hasError(makeNote({ type: 5, lane: 1 }))).toBeTruthy()
  })

  it('通常ノート(type: 1)で lane: -1 はエラーを返す', () => {
    expect(hasError(makeNote({ type: 1, lane: -1 }))).toBeTruthy()
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

  it('type 1 / 89 の [speed, orbit, curve, width] オプションを保持する', () => {
    const note = makeNote({ type: 1, option: ['', '', 'ease', '2.0'] })
    const result = getValidatedOptions(note)
    expect(result).toEqual(['', '', 'ease', '2.0'])
  })

  it('type 1 / 89 で末尾のデフォルト幅 (1, 1.0, -1, 0, 不正値) やデフォルト曲線 (linear) を切り詰める', () => {
    const note1 = makeNote({ type: 89, option: ['1.5', '', 'linear', '1'] })
    expect(getValidatedOptions(note1)).toEqual(['1.5'])

    const note2 = makeNote({ type: 89, option: ['1.5', '', 'linear', '1.0'] })
    expect(getValidatedOptions(note2)).toEqual(['1.5'])

    const note3 = makeNote({ type: 89, option: ['1.5', '', 'linear', '-1'] })
    expect(getValidatedOptions(note3)).toEqual(['1.5'])

    const note4 = makeNote({ type: 89, option: ['1.5', '', 'linear', '0'] })
    expect(getValidatedOptions(note4)).toEqual(['1.5'])

    const note5 = makeNote({ type: 1, option: ['', '', 'ease', ''] })
    expect(getValidatedOptions(note5)).toEqual(['', '', 'ease'])
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

  it('レーン非使用ノートや音札ノートの lane を正規化する', () => {
    const bpmNote = makeNote({ type: 98, lane: 2 as any })
    expect(getValidatedNote(bpmNote).lane).toBe(-1)

    const otofudaNote = makeNote({ type: 5, lane: 1 as any })
    expect(getValidatedNote(otofudaNote).lane).toBe(3)
  })
})
