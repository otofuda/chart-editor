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
})
