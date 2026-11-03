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
