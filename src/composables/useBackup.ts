import { ref } from 'vue'
import type { Measure, ExtendedNoteData } from '../types'
import { noteTypes } from './useNoteTypes'
import type { useChartData } from './useChartData'

type ChartData = ReturnType<typeof useChartData>

type LogEntry = { message: string; type: string; date: Date }

type AnalysisData = {
  notesCount: number
  trendValues: number[]
  trendLabels: string[]
  otofudaNotes: number[]
  typeCount: Record<number, number>
}

/**
 * スナックバー通知・メッセージログ・バックアップ・譜面分析を管理する composable
 * @param chartData - useChartData の戻り値
 */
export function useBackup(chartData: ChartData) {
  const { chartObject, currentChart, measureData } = chartData

  /** スナックバーの表示状態 */
  const snackbar = ref(false)

  /** スナックバーのテキスト */
  const snackbarText = ref('メッセージ')

  /** メッセージログ */
  const logs = ref<LogEntry[]>([])

  /** 譜面分析データ */
  const analysisData = ref<AnalysisData>({
    notesCount: 0,
    trendValues: [],
    trendLabels: [],
    otofudaNotes: [],
    typeCount: {},
  })

  /**
   * スナックバーにメッセージを表示し、ログに記録する
   * @param message - 表示するメッセージ
   */
  function showSnackbar(message: string): void {
    snackbar.value = false
    snackbarText.value = message
    setTimeout(() => (snackbar.value = true), 100)
    logs.value.push({
      message,
      type: '通知バー',
      date: new Date(),
    })
  }

  /**
   * LocalStorage に譜面バックアップを保存する (Ctrl+S)
   */
  function saveBackup(): void {
    localStorage.setItem('chart-editor__backup', JSON.stringify(chartObject.value))
    showSnackbar('譜面バックアップを保存しました')
  }

  /**
   * LocalStorage のバックアップから譜面を復元する
   */
  function restoreBackup(): void {
    const confirmed = window.confirm(
      'バックアップからデータを復元しますか？(現在の譜面データは失われます)'
    )
    const backupData = localStorage.getItem('chart-editor__backup')
    if (confirmed && backupData) {
      chartObject.value = JSON.parse(backupData)
      showSnackbar('バックアップから復元しました')
    }
  }

  /**
   * 現在の難易度の譜面を分析する
   */
  function analyze(): void {
    // 分析データを初期化
    analysisData.value.trendLabels = []
    analysisData.value.trendValues = []
    analysisData.value.otofudaNotes = []
    analysisData.value.notesCount = 0
    noteTypes.forEach((type) => {
      analysisData.value.typeCount[type.value] = 0
    })
    // ラベルとデータ配列を初期化
    measureData.value.forEach((m: Measure) => {
      if (m.measure % 10 === 0)
        analysisData.value.trendLabels.push(String(m.measure))
      else analysisData.value.trendLabels.push(' ')
      analysisData.value.trendValues.push(0)
      analysisData.value.otofudaNotes.push(0)
    })
    // 分析
    currentChart.value.forEach((note: ExtendedNoteData) => {
      // 判定オブジェクト => ノーツ数を加算
      if ([1, 2, 3, 4, 5, 6, 7].includes(note.type)) {
        analysisData.value.trendValues[note.measure] += 1
        analysisData.value.notesCount += 1
      }
      if (note.type === 5) analysisData.value.otofudaNotes[note.measure] += 1
      analysisData.value.typeCount[note.type] = (analysisData.value.typeCount[note.type] || 0) + 1
    })
  }

  return {
    snackbar,
    snackbarText,
    logs,
    analysisData,
    showSnackbar,
    saveBackup,
    restoreBackup,
    analyze,
  }
}
