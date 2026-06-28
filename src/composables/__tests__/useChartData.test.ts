import { describe, it, expect } from 'vitest'
import { useChartData } from '../useChartData'

describe('useChartData', () => {
  it('初期状態でデフォルト値が正しく設定されている', () => {
    const data = useChartData()
    expect(data.currentDifficulty.value).toBe('easy')
    expect(data.chartObject.value.info.bpm).toBe(120)
    expect(data.chartObject.value.info.beat).toBe(4)
    expect(data.chartObject.value.info.offset).toBe(0)
  })

  it('難易度を変更するとcurrentChartが切り替わる', () => {
    const data = useChartData()
    data.chartObject.value.hard = [
      { index: 1, type: 1, lane: 1, measure: 0, position: 0, split: 8, option: [], end: [] }
    ]
    data.currentDifficulty.value = 'hard'
    expect(data.currentChart.value.length).toBe(1)
    expect(data.currentChart.value[0].lane).toBe(1)
  })

  it('ノーツが空のときmaxMeasureは1を返す', () => {
    const data = useChartData()
    expect(data.maxMeasure.value).toBe(1)
  })

  it('deleteNotesで指定インデックスのノートが削除される', () => {
    const data = useChartData()
    data.chartObject.value.easy = [
      { index: 1, type: 1, lane: 1, measure: 0, position: 0, split: 8, option: [], end: [] },
      { index: 2, type: 1, lane: 2, measure: 0, position: 0, split: 8, option: [], end: [] }
    ]
    data.currentDifficulty.value = 'easy'
    data.deleteNotes(1)
    expect(data.currentChart.value.length).toBe(1)
    expect(data.currentChart.value[0].index).toBe(2)
  })

  it('measureDataが少なくとも1要素を返す', () => {
    const data = useChartData()
    expect(data.measureData.value.length).toBeGreaterThanOrEqual(1)
  })

  it('beatHeightが0より大きい初期値を持つ', () => {
    const data = useChartData()
    expect(data.beatHeight.value).toBeGreaterThan(0)
  })
})
