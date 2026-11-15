import { ref, computed } from 'vue'
import type { NoteData, LaneType } from 'chart-types'
import type { ExtendedNoteData, DifficultyString } from '../types'
import type { useChartData } from './useChartData'
import { noteOptions } from './useNoteTypes'

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

  /** 現在の難易度で選択中のノーツ（ロングの子ノーツは含めない）。 */
  const selectionNotes = computed(() =>
    currentChart.value.filter((note) => note.isSelected)
  )

  /** 現在の難易度で選択中のノーツ数。 */
  const selectionNumber = computed(() => selectionNotes.value.length)

  /** 全選択ノーツのtypeが一致した場合だけ、そのtypeを返す。 */
  const selectionCommonType = computed(() => {
    const targets = selectionNotes.value
    const type = targets[0]?.type

    if (type === undefined || !targets.every(note => note.type === type)) {
      return null
    }

    return type
  })

  /** 同じtypeに加え、optionの並びが共通する上下左右フリックの混在を許可する。 */
  const selectionOptionsCompatible = computed(() => {
    const targets = selectionNotes.value

    return (
      selectionCommonType.value !== null ||
      (
        targets.length > 0 &&
        targets.every(note => [3, 4, 6, 7].includes(note.type))
      )
    )
  })

  /** 互換性のある選択ノーツの既存定義から、一括変更できる項目を取得する。 */
  const selectionOptionDefinitions = computed(() => {
    // ダミーは擬態先によって項目が変わるため、今回の一括変更には含めない。
    if (!selectionOptionsCompatible.value || selectionCommonType.value === 90) {
      return []
    }

    return noteOptions(selectionNotes.value[0])
  })

  /** 画面表示と実行時の検証で、同じ利用条件を共有する。 */
  const selectionOptionsDisabledReason = computed(() => {
    if (selectionNumber.value === 0) {
      return 'ノーツを1つ以上選択してください。'
    }

    if (!selectionOptionsCompatible.value) {
      return '選択ノーツのtypeを同一にするか、上下左右のフリックだけを選択してください。'
    }

    if (selectionCommonType.value === 90) {
      return 'ダミーノーツ（type:90）はオプションの一括変更の対象外です。'
    }

    if (selectionOptionDefinitions.value.length === 0) {
      return 'このtypeには変更できるオプションがありません。'
    }

    return ''
  })

  /** 指定されたoptionの添字だけを変更する。空文字も値の消去として適用する。 */
  function selectionChangeOptions(changes: Record<number, string>): boolean {
    if (selectionOptionsDisabledReason.value) {
      showSnackbar(selectionOptionsDisabledReason.value)
      return false
    }

    // 一部だけ変更されないよう、すべての添字と値を先に検証する。
    const entries = Object.entries(changes)
    const hasInvalidEntry = entries.some(([key, value]) => {
      const index = Number(key)

      return (
        !Number.isInteger(index) ||
        String(index) !== key ||
        index < 0 ||
        index >= selectionOptionDefinitions.value.length ||
        typeof value !== 'string'
      )
    })

    if (entries.length === 0 || hasInvalidEntry) {
      showSnackbar('変更するオプションを正しく指定してください。')
      return false
    }

    const targets = selectionNotes.value

    targets.forEach(note => {
      // ノーツ間で配列を共有せず、未指定の項目と定義外の値も保持する。
      const option = [...note.option]

      entries.forEach(([key, value]) => {
        const index = Number(key)

        // 途中の空欄は保存時の既存処理で補完する。
        while (option.length <= index) {
          option.push('')
        }

        option[index] = value
      })

      note.option = option
    })

    showSnackbar(`${targets.length}個のノーツのオプションを一括変更しました`)
    return true
  }

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
    selectionNotes,
    selectionCommonType,
    selectionOptionDefinitions,
    selectionOptionsDisabledReason,
    selectionChangeOptions: (changes: Record<number, string>) => chartData.history.run(
      { label: 'オプションを一括変更' },
      () => selectionChangeOptions(changes)
    ),
    selectionLaneTo,
    selectionLaneAddition,
    selectionTypeTo,
    selectionMeasureAddition,
    selectionClear,
    selectionDelete: (close: () => void) => chartData.history.run(
      { label: '選択ノーツを削除' },
      () => selectionDelete(close)
    ),
    selectionChangeType: (type: number) => chartData.history.run(
      { label: 'ノーツ種別を一括変更' },
      () => selectionChangeType(type)
    ),
    selectionChangeLane: (lane: LaneType) => chartData.history.run(
      { label: 'レーンを一括変更' },
      () => selectionChangeLane(lane)
    ),
    selectionAddLane: (diff: number) => chartData.history.run(
      { label: 'レーンを一括加算' },
      () => selectionAddLane(diff)
    ),
    selectionAddMeasure: (diff: number) => chartData.history.run(
      { label: '小節を一括移動' },
      () => selectionAddMeasure(diff)
    ),
    batchSelect,
  }
}
