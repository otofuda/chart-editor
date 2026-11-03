import { describe, it, expect } from 'vitest'
import { useChartData, normalizeChartData } from '../useChartData'

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

describe('normalizeChartData', () => {
  it('null または undefined の場合でもデフォルトの譜面構造を返す', () => {
    const normalized = normalizeChartData(null)
    expect(normalized.raku).toEqual([])
    expect(normalized.easy).toEqual([])
    expect(normalized.normal).toEqual([])
    expect(normalized.hard).toEqual([])
    expect(normalized.extra).toEqual([])
    expect(normalized.info).toEqual({
      version: 2,
      offset: 0,
      bpm: 120,
      beat: 4,
    })
  })

  it('index が未定義のノートに index を付与し isSelected を false にする', () => {
    const raw = {
      easy: [
        { type: 1, lane: 1, measure: 0, position: 0, split: 8, option: [], end: [] },
        { type: 2, lane: 2, measure: 0, position: 2, split: 8, option: [], end: [] },
      ],
    }
    const normalized = normalizeChartData(raw as any)
    expect(normalized.easy[0].index).toBe(0)
    expect(normalized.easy[0].isSelected).toBe(false)
    expect(normalized.easy[1].index).toBe(1)
    expect(normalized.easy[1].isSelected).toBe(false)
  })

  it('既存の index を維持しつつ isSelected を false に正規化する', () => {
    const raw = {
      hard: [
        { index: 5, isSelected: true, type: 1, lane: 1, measure: 0, position: 0, split: 8, option: [], end: [] },
      ],
    }
    const normalized = normalizeChartData(raw as any)
    expect(normalized.hard[0].index).toBe(5)
    expect(normalized.hard[0].isSelected).toBe(false)
  })
})
