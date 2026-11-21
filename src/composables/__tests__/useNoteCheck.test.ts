import { describe, it, expect } from 'vitest'
import { isDuplicated, hasError, getOtofudaMismatchWarnings, getValidatedOptions, getValidatedNote } from '../useNoteCheck'
import type { DifficultyString, ExtendedChartData, ExtendedNoteData } from '../../types'

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

describe('getOtofudaMismatchWarnings', () => {
  const difficulties: DifficultyString[] = ['raku', 'easy', 'normal', 'hard', 'extra']

  function makeChart(withOtofuda = true): ExtendedChartData {
    return {
      ...Object.fromEntries(difficulties.map(difficulty => [
        difficulty,
        withOtofuda ? [makeNote({ type: 5, lane: 3, position: 1, split: 4 })] : [],
      ])),
      info: { version: 2, bpm: 120, beat: 4, offset: 0 },
    } as ExtendedChartData
  }

  it('全難易度が空、または音札以外のみの場合は警告しない', () => {
    const chart = makeChart(false)
    expect(getOtofudaMismatchWarnings(chart, difficulties).size).toBe(0)
    chart.easy = [makeNote(), makeNote({ type: 90, option: ['5'] })]
    expect(getOtofudaMismatchWarnings(chart, difficulties).size).toBe(0)
  })

  it('約分・レーン・オプション・配列順・indexの差を無視し、入力を変更しない', () => {
    const chart = makeChart()
    difficulties.forEach((difficulty, i) => {
      chart[difficulty][0] = makeNote({
        type: 5, lane: (i + 1) as ExtendedNoteData['lane'], index: i,
        position: i + 1, split: (i + 1) * 4, option: [String(i + 1)],
      })
      const other = makeNote({ index: 10 + i })
      if (i % 2) chart[difficulty].push(other)
      else chart[difficulty].unshift(other)
    })
    const original = structuredClone(chart)
    expect(getOtofudaMismatchWarnings(chart, difficulties).size).toBe(0)
    expect(chart).toEqual(original)
  })

  it('空の難易度も含め、不足する難易度を固定順で既存の音札に通知する', () => {
    const chart = makeChart()
    chart.raku = []
    chart.hard = [makeNote()]
    const warnings = getOtofudaMismatchWarnings(chart, difficulties)
    expect(warnings.size).toBe(3)
    for (const difficulty of ['easy', 'normal', 'extra'] as const) {
      expect(warnings.get(chart[difficulty][0])).toBe('音札ノーツ位置が一致していません：RAKU、HARD')
    }
    expect(warnings.has(chart.hard[0])).toBe(false)
  })

  it.each([
    { measure: 1 },
    { position: 2 },
    { split: 8 },
  ])('音札の位置ずれを両側で検出し、基準難易度を設けない: %j', difference => {
    const chart = makeChart()
    Object.assign(chart.hard[0], difference)
    const warnings = getOtofudaMismatchWarnings(chart, difficulties)
    expect(warnings.size).toBe(5)
    expect(warnings.get(chart.easy[0])).toBe('音札ノーツ位置が一致していません：HARD')
    expect(warnings.get(chart.hard[0])).toBe('音札ノーツ位置が一致していません：RAKU、EASY、NORMAL、EXTRA')
  })

  it('音札ダミーは音札の代わりに数えず、ダミー自身にも警告しない', () => {
    const chart = makeChart()
    chart.hard[0].type = 90
    chart.hard[0].option = ['5']
    const warnings = getOtofudaMismatchWarnings(chart, difficulties)
    expect(warnings.size).toBe(4)
    expect(warnings.get(chart.easy[0])).toBe('音札ノーツ位置が一致していません：HARD')
    expect(warnings.has(chart.hard[0])).toBe(false)
  })

  it('重複数の差を無視し、同じ難易度の重複で他難易度の欠落を埋めない', () => {
    const chart = makeChart()
    chart.easy.push(makeNote({ ...chart.easy[0], index: 2 }))
    expect(getOtofudaMismatchWarnings(chart, difficulties).size).toBe(0)
    chart.hard = []
    const warnings = getOtofudaMismatchWarnings(chart, difficulties)
    expect(warnings.size).toBe(5)
    expect(warnings.get(chart.easy[0])).toBe('音札ノーツ位置が一致していません：HARD')
    expect(warnings.get(chart.easy[1])).toBe(warnings.get(chart.easy[0]))
  })

  it.each([
    { measure: NaN }, { measure: Infinity }, { measure: -1 },
    { position: NaN }, { position: Infinity }, { position: -1 }, { position: 4 },
    { split: NaN }, { split: Infinity }, { split: 0 }, { split: -4 },
    { position: '' as unknown as number }, { split: '' as unknown as number },
  ])('比較不能な位置の音札を集計と警告から除外する: %j', difference => {
    const chart = makeChart()
    Object.assign(chart.hard[0], difference)
    const warnings = getOtofudaMismatchWarnings(chart, difficulties)
    expect(warnings.size).toBe(4)
    expect(warnings.get(chart.easy[0])).toBe('音札ノーツ位置が一致していません：HARD')
    expect(warnings.has(chart.hard[0])).toBe(false)
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
    expect(result).toEqual(['1', '0', 'ease', '2.0'])
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
    expect(getValidatedOptions(note5)).toEqual(['1', '0', 'ease'])
  })

  it.each([
    [1, ['', '1.5'], ['1', '1.5']],
    [2, ['', '1.5'], ['1', '1.5']],
    [3, ['', '', '', '', '2'], ['-1', '0', '1', '1', '2']],
    [4, ['', '', '', '2'], ['-1', '0', '1', '2']],
    [5, [0], ['0']],
    [6, ['', '', '2'], ['-1', '0', '2']],
    [7, ['', '2'], ['-1', '2']],
    [89, ['', '', '', '2'], ['1', '0', 'linear', '2']],
    [90, ['2', '', '1.5'], ['2', '1', '1.5']],
    [90, ['3', '', '', '', '', '2'], ['3', '-1', '0', '1', '1', '2']],
    [90, ['', '', '2'], ['1', '1', '2']],
    [91, ['', '', 'flag'], ['', '', 'flag']],
    [93, ['4', ''], ['4']],
    [94, ['', '', '', '', '', '', '2'], ['texture/202020.png', '1', '0.25', '0', '1', '1', '2']],
    [95, ['', '', '2'], ['1', '1', '2']],
    [96, ['', '', '128'], ['0', '0', '128']],
    [97, [0], ['0']],
    [98, ['0'], ['0']],
    [99, [], []],
    [100, ['comment', ''], ['comment']],
  ])('type %i の後続入力を保持して途中の空欄を補完する (%j)', (type, input, expected) => {
    const note = makeNote({ type, position: 1, option: input as string[] })
    const original = structuredClone(note)
    const option = getValidatedOptions(note)
    expect(option).toEqual(expected)
    expect(getValidatedOptions({ ...note, option })).toEqual(option)
    expect(note).toEqual(original)
  })

  it.each([
    [1, []], [2, []], [3, ['-1']], [4, ['-1']], [5, []],
    [6, ['-1']], [7, ['-1']], [89, []], [90, []], [91, []], [93, []],
    [94, ['texture/202020.png', '1', '0.25']], [95, ['1']],
    [96, ['0', '0', '0']], [97, ['-1']], [98, ['-1']], [99, []], [100, ['']],
  ])('type %i の全項目未入力では必須項目だけを補完する', (type, expected) => {
    const note = makeNote({ type, position: 1, option: [null, undefined, ''] as unknown as string[] })
    const option = getValidatedOptions(note)
    expect(option).toEqual(expected)
    expect(getValidatedOptions({ ...note, option })).toEqual(option)
  })

  it('配列の空き・null・undefinedを補完し、数値の0と文字列の0を保持する', () => {
    const option = new Array(5)
    option[1] = 0
    option[2] = null
    option[4] = '0'
    expect(getValidatedOptions(makeNote({ type: 3, option }))).toEqual(['-1', '0', '1', '1', '0'])
    expect(0 in option).toBe(false)
    expect(option[2]).toBeNull()
  })

  it('末尾の空欄だけを省略する', () => {
    expect(getValidatedOptions(makeNote({ type: 2, option: ['2', '', ''] }))).toEqual(['2'])
    expect(getValidatedOptions(makeNote({ type: 91, option: ['', 'name', ''] }))).toEqual(['', 'name'])
  })

  it('小節線非表示制御の後続オプションを保持する', () => {
    expect(getValidatedOptions(makeNote({ type: 95, position: 0, option: ['3', '', '2'] })))
      .toEqual(['-1', '1', '2'])
  })

  it('LEDのリセット値を保持する', () => {
    expect(getValidatedOptions(makeNote({ type: 96, option: ['-1', '-1', '-1'] })))
      .toEqual(['-1', '-1', '-1'])
  })

  it('不正なダミー擬態先や未知typeの入力を保持し、無限再帰しない', () => {
    expect(getValidatedOptions(makeNote({ type: 90, option: ['90', '', 'x'] })))
      .toEqual(['90', '', 'x'])
    expect(getValidatedOptions(makeNote({ type: 123, option: ['', 'x'] }))).toEqual(['', 'x'])
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
    expect(validated.end[0].option).toEqual(['1', '0', 'ease'])
    expect(validated.end[0].end.length).toBe(1)
    expect(validated.end[0].end[0].lane).toBe(5)
    expect(validated.end[0].end[0].option).toEqual(['1', '0', 'easeIn'])
  })

  it.each([1, 3, 89, 90, 98])('単独のtype %iに付いたendを保存時に除去し、元データは保持する', type => {
    const note = makeNote({ type, option: type === 90 ? ['1'] : [], end: [makeNote()] })
    const original = structuredClone(note)
    expect(getValidatedNote(note).end).toEqual([])
    expect(note).toEqual(original)
  })

  it('ダミーLNの分岐・不可視中点を保持し、不正なノードの子は除去する', () => {
    const note = makeNote({ type: 90, option: ['2', '', '1.5'], end: [
      makeNote({ type: 89, end: [makeNote()] }),
      makeNote({ type: 98, end: [makeNote()] }),
    ] })
    const original = structuredClone(note)
    const normalized = getValidatedNote(note)
    expect(normalized.option).toEqual(['2', '1', '1.5'])
    expect(normalized.end).toHaveLength(2)
    expect(normalized.end[0].end).toHaveLength(1)
    expect(normalized.end[1].end).toEqual([])
    expect(note).toEqual(original)
    expect(getValidatedNote(normalized)).toEqual(normalized)
  })

  it('Array.mapから呼んでも配列インデックスを中点の判定に使わない', () => {
    const notes = [makeNote(), makeNote({ end: [makeNote()] })]
    expect(notes.map(getValidatedNote).map(note => note.end)).toEqual([[], []])
  })

  it.each([91, 92, 93, 96, 97, 98, 99, 100])('type %i のレーン検証と保存時正規化が一致する', type => {
    expect(hasError(makeNote({ type, lane: -1 }))).toBe(false)
    expect(hasError(makeNote({ type, lane: 2 }))).toBeTruthy()
    expect(getValidatedNote(makeNote({ type, lane: 2 })).lane).toBe(-1)
  })

  it('レーン非使用ノートや音札ノートの lane を正規化する', () => {
    const bpmNote = makeNote({ type: 98, lane: 2 as any })
    expect(getValidatedNote(bpmNote).lane).toBe(-1)

    const otofudaNote = makeNote({ type: 5, lane: 1 as any })
    expect(getValidatedNote(otofudaNote).lane).toBe(3)
  })
})
