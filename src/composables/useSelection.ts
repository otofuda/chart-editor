import { ref, computed } from 'vue'
import type { NoteData, LaneType } from 'chart-types'
import type { ExtendedNoteData, DifficultyString } from '../types'
import type { useChartData } from './useChartData'

type ChartData = ReturnType<typeof useChartData>

/**
 * ノートの一括選択・変更を管理する composable
 * @param chartData - useChartData の戻り値
 * @param showSnackbar - スナックバー表示関数
 */
export function useSelection(
  chartData: ChartData,
  showSnackbar: (message: string) => void
) {
  const { chartObject, currentDifficulty, currentChart } = chartData

  /** 一括選択の対象 Type */
  const batchSelectTypes = ref<number[]>([])
  /** 一括選択の開始小節 */
  const batchSelectStart = ref(0)
  /** 一括選択の終了小節 (0 は譜面末尾まで) */
  const batchSelectEnd = ref(0)

  /** 選択ノーツへの操作: 移動先レーン */
  const selectionLaneTo = ref<LaneType>(1)
  /** 選択ノーツへの操作: レーン加算値 */
  const selectionLaneAddition = ref(1)
  /** 選択ノーツへの操作: 変更先 Type */
  const selectionTypeTo = ref(1)
  /** 選択ノーツへの操作: 小節加算値 */
  const selectionMeasureAddition = ref(0)

  /** 一括選択の対象ノーツ (computed) */
  const batchSelectTarget = computed<ExtendedNoteData[]>(() => {
    const min = batchSelectStart.value
    const max = batchSelectEnd.value === 0 ? Infinity : batchSelectEnd.value
    return currentChart.value.filter(
      (note) =>
        batchSelectTypes.value.includes(note.type) &&
        note.measure >= min &&
        note.measure <= max
    )
  })

  /** 選択中のノーツ個数 */
  const selectionNumber = computed(() =>
    currentChart.value.filter((note) => note.isSelected).length
  )

  /**
   * すべて選択解除する
   */
  function selectionClear(): void {
    chartObject.value[currentDifficulty.value] = currentChart.value.map(
      (note: NoteData) => ({ ...note, isSelected: false })
    )
  }

  /**
   * 選択ノーツを削除する
   */
  function selectionDelete(closeDialog: () => void): void {
    const num = selectionNumber.value
    chartObject.value[currentDifficulty.value] = currentChart.value.filter(
      (note: ExtendedNoteData) => !note.isSelected
    )
    closeDialog()
    showSnackbar(`${num}個のノーツを削除しました`)
  }

  /**
   * 選択ノーツの Type を一括変更する
   * @param type - 変更先の Type
   */
  function selectionChangeType(type: number): void {
    const t = Number(type)
    if ([2, 5, 94].includes(t)) {
      showSnackbar(`Typeを${t}に一括変更することはできません`)
      return
    }
    const targets = chartObject.value[currentDifficulty.value].filter(
      (note) => note.isSelected && ![2, 5].includes(note.type)
    )
    if (targets.length === 0) {
      showSnackbar('対象ノーツがありません(Type一括変更)')
      return
    }
    targets.forEach((note: ExtendedNoteData) => (note.type = t))
    showSnackbar(`Type:${t}への一括変更を実行しました`)
  }

  /**
   * 選択ノーツのレーンを一括変更する
   * @param lane - 変更先のレーン
   */
  function selectionChangeLane(lane: LaneType): void {
    const targets = chartObject.value[currentDifficulty.value].filter(
      (note) => note.isSelected && ![2, 5].includes(note.type)
    )
    if (targets.length === 0) {
      showSnackbar('対象ノーツがありません(Lane一括変更)')
      return
    }
    targets.forEach((note: ExtendedNoteData) => (note.lane = lane))
    showSnackbar(`Lane:${lane}への一括変更を実行しました`)
  }

  /**
   * 選択ノーツのレーンを加算または減算する
   * @param diff - 加算/減算する値
   */
  function selectionAddLane(diff: number): void {
    const d = Number(diff)
    const targets = chartObject.value[currentDifficulty.value].filter(
      (note) => note.isSelected && ![2, 5].includes(note.type)
    )
    if (targets.length === 0) {
      showSnackbar('対象ノーツがありません(Lane一括加算)')
      return
    }
    if (d < 0) {
      targets.forEach(
        (note: NoteData) => (note.lane = Math.max(note.lane + d, 1) as LaneType)
      )
      showSnackbar(`${d} 一括減算処理を実行しました`)
    } else {
      targets.forEach(
        (note: NoteData) => (note.lane = Math.min(note.lane + d, 5) as LaneType)
      )
      showSnackbar(`+${d} 一括加算処理を実行しました`)
    }
  }

  function shiftMeasureRecursive(note: NoteData, diff: number): void {
    note.measure = Math.max(note.measure + diff, 0)
    if (note.end && Array.isArray(note.end)) {
      note.end.forEach((end: NoteData) => shiftMeasureRecursive(end, diff))
    }
  }

  /**
   * 選択ノーツの小節を加算または減算する
   * @param diff - 加算/減算する値
   */
  function selectionAddMeasure(diff: number): void {
    const d = Number(diff)
    const targets = chartObject.value[currentDifficulty.value].filter(
      (note) => note.isSelected
    )
    targets.forEach((note: NoteData) => {
      shiftMeasureRecursive(note, d)
    })
    showSnackbar(`小節位置 ${d} 一括処理を実行しました`)
  }

  /**
   * batchSelectTarget の全ノーツを選択状態にする
   */
  function batchSelect(): void {
    const num = batchSelectTarget.value.length
    batchSelectTarget.value.forEach((target) => (target.isSelected = true))
    showSnackbar(`${num}個のノーツを一括選択しました`)
  }

  return {
    batchSelectTypes,
    batchSelectStart,
    batchSelectEnd,
    batchSelectTarget,
    selectionNumber,
    selectionLaneTo,
    selectionLaneAddition,
    selectionTypeTo,
    selectionMeasureAddition,
    selectionClear,
    selectionDelete,
    selectionChangeType,
    selectionChangeLane,
    selectionAddLane,
    selectionAddMeasure,
    batchSelect,
  }
}
