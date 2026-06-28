import { ref } from 'vue'
import type { DifficultyString, ExtendedChartData, ExtendedNoteData } from '../types'
import { getValidatedNote } from './useNoteCheck'
import type { useChartData } from './useChartData'

type ChartData = ReturnType<typeof useChartData>

/**
 * ファイルの読み込み・保存・音声ファイル操作を管理する composable
 * @param chartData - useChartData の戻り値
 * @param showSnackbar - スナックバー表示関数
 */
export function useFileIO(
  chartData: ChartData,
  showSnackbar: (message: string) => void
) {
  const { chartObject, currentDifficulty, difficulties } = chartData

  /** 読み込んでいるファイル名 */
  const fileName = ref('default-song.json')

  /** 譜面ファイルを読み込んだかどうか */
  const isLoaded = ref(false)

  /** 楽曲プレビュー用の Audio オブジェクト */
  const previewAudio = ref(new Audio())

  /** 楽曲音量 (0-100) */
  const audioVolume = ref(100)

  const reader = new FileReader()
  reader.onload = (event) => {
    if (!event.target?.result) return
    const parsed: ExtendedChartData = JSON.parse(String(event.target.result))
    chartObject.value = parsed
    difficulties.forEach((d: DifficultyString) => {
      chartObject.value[d] = (chartObject.value[d] || []).map((note, index) => ({
        // 編集用の情報を付加
        ...note,
        index,
        isSelected: false,
      }))
    })
    isLoaded.value = true
  }

  /**
   * JSON ファイルを読み込む
   * @param file - 読み込むファイル (Vuetify 4 の @update:model-value は File | File[] を渡す)
   */
  function readFile(file: File | File[] | null | undefined): void {
    const actual = Array.isArray(file) ? (file[0] ?? null) : (file ?? null)
    if (!actual) return
    fileName.value = actual.name
    reader.readAsText(actual)
  }

  /**
   * 新しい譜面を作成する (空のファイル)
   */
  function newFile(): void {
    fileName.value = 'default.json'
    isLoaded.value = true
  }

  /**
   * JSON ファイルを名前をつけて保存する
   */
  function saveFile(): void {
    const saveObject: Record<string, unknown> = {
      raku: [],
      easy: [],
      normal: [],
      hard: [],
      extra: [],
      info: {
        version: 2,
        ...chartObject.value.info,
      },
    }
    // 各ノートにバリデーションを実行
    difficulties.forEach((d: DifficultyString) => {
      (saveObject[d] as unknown[]) = chartObject.value[d].map(getValidatedNote)
    })
    const blob = new Blob([JSON.stringify(saveObject, null, 4)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fileName.value
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    showSnackbar(`ファイル「${fileName.value}」を保存しました`)
  }

  /**
   * 楽曲ファイルを読み込んで Audio に設定する
   * @param file - 読み込む音声ファイル (Vuetify 4 の @update:model-value は File | File[] を渡す)
   */
  function readAudioFile(file: File | File[] | null | undefined): void {
    const actual = Array.isArray(file) ? (file[0] ?? null) : (file ?? null)
    if (!actual) return
    previewAudio.value.src = window.URL.createObjectURL(actual)
  }

  return {
    fileName,
    isLoaded,
    previewAudio,
    audioVolume,
    readFile,
    newFile,
    saveFile,
    readAudioFile,
  }
}
