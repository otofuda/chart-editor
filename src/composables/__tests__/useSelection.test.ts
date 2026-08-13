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
})
