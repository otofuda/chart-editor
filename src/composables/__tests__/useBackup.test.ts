import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useChartData } from '../useChartData'
import { useBackup } from '../useBackup'

describe('useBackup', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('saveBackup で localStorage に譜面データが保存される', () => {
    const chartData = useChartData()
    const backup = useBackup(chartData)

    chartData.chartObject.value.easy = [
      { index: 1, type: 1, lane: 1, measure: 0, position: 0, split: 8, option: [], end: [] }
    ]

    backup.saveBackup()

    const saved = localStorage.getItem('chart-editor__backup')
    expect(saved).not.toBeNull()
    const parsed = JSON.parse(saved!)
    expect(parsed.easy.length).toBe(1)
  })

  it('restoreBackup で確認後、正規化されたデータが復元される', () => {
    const chartData = useChartData()
    const backup = useBackup(chartData)

    // 確認ダイアログを true にモック
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    // 不完全な（index や isSelected が欠落した）バックアップデータを保存
    const rawBackup = {
      easy: [
        { type: 1, lane: 2, measure: 1, position: 0, split: 8, option: [], end: [] }
      ]
    }
    localStorage.setItem('chart-editor__backup', JSON.stringify(rawBackup))

    backup.restoreBackup()

    // 復元されたデータに index: 0, isSelected: false が付与されていること
    expect(chartData.chartObject.value.easy.length).toBe(1)
    expect(chartData.chartObject.value.easy[0].index).toBe(0)
    expect(chartData.chartObject.value.easy[0].isSelected).toBe(false)
    // info オブジェクトも補完されていること
    expect(chartData.chartObject.value.info.version).toBe(2)
    expect(chartData.chartObject.value.info.bpm).toBe(120)
  })

  it('restoreBackup で confirm が false の場合は復元されない', () => {
    const chartData = useChartData()
    const backup = useBackup(chartData)

    vi.spyOn(window, 'confirm').mockReturnValue(false)
    localStorage.setItem('chart-editor__backup', JSON.stringify({ easy: [{ type: 1 }] }))

    backup.restoreBackup()

    expect(chartData.chartObject.value.easy.length).toBe(0)
  })

  it('不正な JSON 文字列の場合はクラッシュせずにエラー通知を行う', () => {
    const chartData = useChartData()
    const backup = useBackup(chartData)

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    localStorage.setItem('chart-editor__backup', '{ invalid json')

    expect(() => backup.restoreBackup()).not.toThrow()
    expect(backup.snackbarText.value).toBe('バックアップデータの読み込みに失敗しました')
  })

  it('analyze でノーツ数・小節ごとの密度・音札数・種別数が正しく計算される', () => {
    const chartData = useChartData()
    const backup = useBackup(chartData)

    chartData.chartObject.value.easy = [
      { index: 1, type: 1, lane: 1, measure: 0, position: 0, split: 8, option: [], end: [] },
      { index: 2, type: 5, lane: 2, measure: 0, position: 2, split: 8, option: [], end: [] },
      { index: 3, type: 2, lane: 3, measure: 1, position: 0, split: 8, option: [], end: [] },
      { index: 4, type: 94, lane: -1, measure: 1, position: 0, split: 8, option: ['url', '1'], end: [] }, // テクスチャ (非ノーツオブジェクト)
    ]

    backup.analyze()

    expect(backup.analysisData.value.notesCount).toBe(3) // type 1, 5, 2
    expect(backup.analysisData.value.trendValues[0]).toBe(2) // 0小節に2ノーツ
    expect(backup.analysisData.value.trendValues[1]).toBe(1) // 1小節に1ノーツ
    expect(backup.analysisData.value.otofudaNotes[0]).toBe(1) // 0小節に音札1個
    expect(backup.analysisData.value.otofudaNotes[1]).toBe(0)
    expect(backup.analysisData.value.typeCount[1]).toBe(1)
    expect(backup.analysisData.value.typeCount[5]).toBe(1)
    expect(backup.analysisData.value.typeCount[2]).toBe(1)
    expect(backup.analysisData.value.typeCount[94]).toBe(1)
  })
})
