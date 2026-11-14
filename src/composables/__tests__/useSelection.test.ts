import { describe, it, expect, vi } from 'vitest'
import { useChartData } from '../useChartData'
import { useSelection } from '../useSelection'
import type { ExtendedNoteData } from '../../types'

function makeNote(overrides: Partial<ExtendedNoteData> = {}): ExtendedNoteData {
  return { index: 1, type: 1, lane: 1, measure: 0, position: 0, split: 8, option: [], end: [], ...overrides }
}

function setup() {
  const chartData = useChartData()
  const showSnackbar = vi.fn()
  const selection = useSelection(chartData, showSnackbar)
  return { chartData, selection, showSnackbar }
}

describe('useSelection', () => {
  it('初期状態でバッチ選択リストは空', () => {
    const { selection } = setup()
    expect(selection.batchSelectTarget.value.length).toBe(0)
  })

  it('batchSelectTargetはbatchSelectTypesでフィルタされる', () => {
    const { chartData, selection } = setup()
    chartData.chartObject.value.easy = [makeNote({ index: 1, type: 1 })]
    chartData.currentDifficulty.value = 'easy'
    // type 1 を選択対象に追加
    selection.batchSelectTypes.value = [1]
    expect(selection.batchSelectTarget.value.length).toBe(1)
  })

  it('batchSelectTypesが空だとbatchSelectTargetも空', () => {
    const { chartData, selection } = setup()
    chartData.chartObject.value.easy = [makeNote({ index: 1, type: 1 })]
    chartData.currentDifficulty.value = 'easy'
    selection.batchSelectTypes.value = []
    expect(selection.batchSelectTarget.value.length).toBe(0)
  })

  it('selectionClearでisSelectedがfalseになる', () => {
    const { chartData, selection } = setup()
    chartData.chartObject.value.easy = [makeNote({ index: 1, isSelected: true } as any)]
    chartData.currentDifficulty.value = 'easy'
    selection.selectionClear()
    expect(chartData.currentChart.value[0].isSelected).toBe(false)
  })

  it('selectionAddMeasureでネスト終点の小節も再帰的に移動する', () => {
    const { chartData, selection } = setup()
    const nestedLN = makeNote({
      index: 1,
      type: 2,
      measure: 2,
      isSelected: true,
      end: [
        makeNote({
          type: 1,
          measure: 3,
          end: [
            makeNote({
              type: 89,
              measure: 4,
              end: [],
            }),
          ],
        }),
      ],
    })
    chartData.chartObject.value.easy = [nestedLN]
    chartData.currentDifficulty.value = 'easy'

    selection.selectionAddMeasure(2)
    const note = chartData.currentChart.value[0]
    expect(note.measure).toBe(4)
    expect(note.end[0].measure).toBe(5)
    expect(note.end[0].end[0].measure).toBe(6)
  })
})

describe('optionの一括変更', () => {
  /** 現在の難易度に、指定したノーツを選択済みの状態で配置する。 */
  function setupSelected(notes: Partial<ExtendedNoteData>[]) {
    const s = setup()

    s.chartData.chartObject.value.easy = notes.map((note, i) =>
      makeNote({ index: i + 1, isSelected: true, ...note })
    )

    return s
  }

  it.each([
    { notes: [], reason: '1つ以上' },
    { notes: [{ type: 3 }, { type: 4 }], reason: '同一' },
    { notes: [{ type: 90, option: ['90'] }], reason: '対象外' },
    { notes: [{ type: 99 }], reason: 'ありません' },
    { notes: [{ type: 92 }], reason: 'ありません' },
  ])('利用条件を満たさない場合は全件変更しない: $reason', ({ notes, reason }) => {
    const s = setupSelected(notes)
    const before = JSON.stringify(s.chartData.chartObject.value)

    expect(s.selection.selectionOptionsDisabledReason.value).toContain(reason)
    expect(s.selection.selectionChangeOptions({ 0: '2' })).toBe(false)
    expect(JSON.stringify(s.chartData.chartObject.value)).toBe(before)
    expect(s.chartData.history.canUndo.value).toBe(false)
  })

  it('共通typeと既存定義を返し、フリックの指定項目だけを変更する', () => {
    const s = setupSelected([
      { type: 3, option: ['2', '1', '4', '1.5', '0', 'extra'] },
      { type: 3, option: ['3', '2', '8', '2', '1'] },
      { type: 4, option: ['4'], isSelected: false },
    ])
    const other = makeNote({ type: 3, isSelected: true, option: ['5'] })
    s.chartData.chartObject.value.hard = [other]

    expect(s.selection.selectionNotes.value).toHaveLength(2)
    expect(s.selection.selectionCommonType.value).toBe(3)
    expect(s.selection.selectionOptionDefinitions.value.map(opt => opt.label))
      .toEqual(['width', 'offsetNumer', 'offsetDenom', 'speed', 'orbit'])

    // 指定した添字だけを変更し、定義外の値や別難易度のノーツも保持する。
    expect(s.selection.selectionChangeOptions({ 0: '4', 4: '-0.5' })).toBe(true)

    const [first, second, unselected] = s.chartData.currentChart.value
    expect(first.option).toEqual(['4', '1', '4', '1.5', '-0.5', 'extra'])
    expect(second.option).toEqual(['4', '2', '8', '2', '-0.5'])
    expect(unselected.option).toEqual(['4'])
    expect(other.option).toEqual(['5'])

    // 一方の配列を直接編集しても、もう一方のノーツには影響しない。
    expect(first.option).not.toBe(second.option)
    first.option[0] = '9'
    expect(second.option[0]).toBe('4')
    expect(s.showSnackbar).toHaveBeenLastCalledWith('2個のノーツのオプションを一括変更しました')
  })

  it('短い配列を空文字で補い、空欄と0をそのまま適用する', () => {
    const s = setupSelected([
      { type: 3, option: ['2'] },
      { type: 3, option: [] },
    ])

    expect(s.selection.selectionChangeOptions({ 0: '', 4: '0' })).toBe(true)

    s.chartData.currentChart.value.forEach(note => {
      expect(note.option).toEqual(['', '', '', '', '0'])
      expect(Object.keys(note.option)).toHaveLength(5)
    })
  })

  it.each([
    {},
    { '-1': '2' },
    { 5: '2' },
    { '0.5': '2' },
    { NaN: '2' },
    { '01': '2' },
  ])('空の指定や不正な添字では、一部にも適用しない: %j', changes => {
    const s = setupSelected([
      { type: 3, option: ['1'] },
      { type: 3, option: ['2'] },
    ])
    const before = JSON.stringify(s.chartData.chartObject.value)

    // 正しい添字が混ざっていても、不正な指定があれば全体を変更しない。
    const patch = Object.keys(changes).length ? { 0: '3', ...changes } : changes

    expect(s.selection.selectionChangeOptions(patch)).toBe(false)
    expect(JSON.stringify(s.chartData.chartObject.value)).toBe(before)
    expect(s.chartData.history.canUndo.value).toBe(false)
  })

  it.each([2, 5, 94, 100])('type:%iは1件の選択でも変更できる', type => {
    const child = makeNote({ option: ['child'], isSelected: true })
    const s = setupSelected([{ type, option: [], end: [child] }])
    const value = type === 100 ? 'コメントを一括変更' : '1.25'

    expect(s.selection.selectionChangeOptions({ 0: value })).toBe(true)
    expect(s.chartData.currentChart.value[0].option).toEqual([value])
    expect(s.chartData.currentChart.value[0].end[0].option).toEqual(['child'])
  })

  it('複数ノーツの変更を1回の操作として取り消し・やり直しできる', () => {
    const s = setupSelected([
      { type: 3, option: ['2'] },
      { type: 3, option: ['3'] },
    ])

    expect(s.selection.selectionChangeOptions({ 0: '4', 4: '1.5' })).toBe(true)

    s.chartData.history.undo()
    expect(s.chartData.currentChart.value.map(note => note.option)).toEqual([['2'], ['3']])
    expect(s.chartData.history.canUndo.value).toBe(false)

    s.chartData.history.redo()
    expect(s.chartData.currentChart.value.map(note => note.option))
      .toEqual([['4', '', '', '', '1.5'], ['4', '', '', '', '1.5']])
  })
})
