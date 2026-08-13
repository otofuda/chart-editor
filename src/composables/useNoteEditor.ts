import { ref, computed, toRaw } from 'vue'
import type { NoteData, LaneType } from 'chart-types'
import type {
  DifficultyString,
  ColorObject,
  ExtendedNoteData,
  ExtendedChartData,
} from '../types'
import { isDuplicated, getValidatedOptions, isLanelessNote } from './useNoteCheck'
import type { useChartData } from './useChartData'

type ChartData = ReturnType<typeof useChartData>

/**
 * ノートの仮配置・挿入・移動・コピーを管理する composable
 * @param chartData - useChartData の戻り値
 * @param showSnackbar - スナックバー表示関数
 * @param scrollToMeasure - 指定小節へスクロールする関数
 */
export function useNoteEditor(
  chartData: ChartData,
  showSnackbar: (message: string) => void,
  scrollToMeasure: (measure: number) => void
) {
  const {
    chartObject,
    currentDifficulty,
    currentChart,
    difficulties,
    measureData,
  } = chartData

  /** 配置するノート */
  const appendNote = ref<ExtendedNoteData>({
    type: 1,
    lane: 1,
    measure: 1,
    position: 0,
    split: 8,
    option: [],
    end: [],
  })

  /** 仮配置中のノーツ配列 */
  const preAppendNotes = ref<ExtendedNoteData[]>([])

  /** ノート挿入モードかどうか */
  const isAppendMode = ref(true)

  /** 編集小節を自動追従するかどうか */
  const isAutoFollow = ref(true)

  /** 挿入モード時に返す AppendNote (isAppendMode が false の時は null) */
  const getAppendNote = computed<ExtendedNoteData | null>(() =>
    isAppendMode.value ? appendNote.value : null
  )

  /**
   * 色オブジェクト ⇔ option 配列の getter/setter
   * Vuetify 4 の v-color-picker (mode="rgba") に対応
   */
  const appendNoteColorOption = computed<ColorObject | null>({
    get: () => {
      if (appendNote.value.type !== 96) return null
      return {
        r: Number(appendNote.value.option[0]),
        g: Number(appendNote.value.option[1]),
        b: Number(appendNote.value.option[2]),
        a: 1,
      }
    },
    set: (value) => {
      if (appendNote.value.type === 96 && value) {
        appendNote.value.option[0] = String(Math.round(value.r))
        appendNote.value.option[1] = String(Math.round(value.g))
        appendNote.value.option[2] = String(Math.round(value.b))
      }
    },
  })

  /**
   * 指定難易度にノートを挿入する内部関数
   * @param targetDifficulty - 挿入先の難易度
   * @param notes - 挿入するノート配列
   */
  function insertInto(targetDifficulty: DifficultyString, notes: NoteData[]): void {
    notes.forEach((note: NoteData) => {
      const chart = chartObject.value[targetDifficulty] as ExtendedNoteData[]
      const dup = isDuplicated(note as ExtendedNoteData, chart, [], {
        checkPreAppend: false,
      })
      if (dup) {
        showSnackbar(`${dup}個のノーツと重複しているため、挿入できないノーツがありました`)
        return
      }
      const index =
        chart.length === 0
          ? 1
          : chart.reduce((max, n) => Math.max(max, n.index ?? 0), 0) + 1
      chart.push({
        isSelected: false,
        ...structuredClone(toRaw(note)),
        index,
        option: getValidatedOptions(note),
      })
    })
  }

  /**
   * ノーツを現在の難易度に挿入する
   * @param notes - 挿入するノート
   */
  function appendNotes(...notes: NoteData[]): void {
    insertInto(currentDifficulty.value, notes)
    showSnackbar(`${notes.length}個のノートの挿入を試行しました`)
    preAppendNotes.value = []
  }

  /**
   * ノーツを仮配置する
   * @param notes - 仮配置するノート
   */
  function placeNotes(...notes: NoteData[]): void {
    notes.forEach((note: NoteData) => {
      const dup = isDuplicated(
        note as ExtendedNoteData,
        currentChart.value,
        preAppendNotes.value
      )
      if (dup) {
        showSnackbar(`${dup}個のノーツと重複しているため、配置はキャンセルされました`)
        return
      }
      const index =
        preAppendNotes.value.length === 0
          ? 1
          : preAppendNotes.value.reduce((max, n) => Math.max(max, n.index ?? 0), 0) + 1
      preAppendNotes.value.push({
        isSelected: false,
        ...structuredClone(toRaw(note)),
        option: getValidatedOptions(note),
        index,
      })
    })
  }

  /**
   * ノーツを全ての難易度に同時挿入する
   * @param notes - 挿入するノート
   */
  function appendSimultaneously(...notes: NoteData[]): void {
    notes.forEach((note: NoteData) => {
      let difficultyCount = 0
      difficulties.forEach((difficulty: DifficultyString) => {
        const chart = chartObject.value[difficulty] as ExtendedNoteData[]
        const dup = isDuplicated(note as ExtendedNoteData, chart, [], {
          comparators: chart,
        })
        if (dup) {
          showSnackbar(`${dup}個のノーツと重複しているため、${difficulty}に挿入できません`)
          return
        }
        const index =
          chart.length === 0
            ? 1
            : chart.reduce((max, n) => Math.max(max, n.index ?? 0), 0) + 1
        chart.push({
          isSelected: false,
          ...structuredClone(toRaw(note)),
          index,
          option: getValidatedOptions(note),
        })
        difficultyCount++
      })
      showSnackbar(`ノートを${difficultyCount}難易度に同時挿入しました`)
    })
  }

  /**
   * appendNote に終点を追加する
   */
  function addEndToAppendNote(): void {
    appendNote.value.end.push({
      type: 1,
      lane: appendNote.value.lane,
      measure: appendNote.value.measure,
      position: Math.min(appendNote.value.position + 1, appendNote.value.split),
      split: appendNote.value.split,
      option: [],
      end: [],
    })
  }

  /**
   * appendNote から終点を削除する
   * @param index - 削除する終点のインデックス
   */
  function deleteEndOfAppendNote(index: number): void {
    appendNote.value.end.splice(index, 1)
  }

  /**
   * ノーツ種別変更時のオプション・終点・レーンを自動調整する
   */
  function changeAppendNoteType(type?: number): void {
    if (type !== undefined) {
      appendNote.value.type = Number(type)
    }

    // end を自動生成／削除
    if (appendNote.value.type === 2) addEndToAppendNote()
    else appendNote.value.end = []

    // type によって option を自動生成
    switch (appendNote.value.type) {
      case 3:
      case 4:
      case 6:
      case 7:
        appendNote.value.option = ['-1']
        break
      case 90:
        appendNote.value.option = ['1']
        break
      case 93:
        appendNote.value.option = ['4']
        break
      case 94:
        appendNote.value.option = ['texture/202020.png', '1', '0.25']
        break
      case 95:
        appendNote.value.option = ['5']
        break
      case 96:
        appendNote.value.option = ['255', '81', '81']
        break
      case 100:
        appendNote.value.option = ['ここにコメントを入力']
        break
      default:
        appendNote.value.option = []
    }

    // lane を自動変更
    if (isLanelessNote(appendNote.value)) appendNote.value.lane = -1
    else if (appendNote.value.lane === -1) appendNote.value.lane = 1
  }

  /**
   * appendNote のレーンを左に移動する
   */
  function appendNoteToLeft(): void {
    const lane = Math.max(appendNote.value.lane - 1, 1) as LaneType
    appendNote.value.lane = lane
    // TODO: ネスト終点に対応
    appendNote.value.end.forEach((end) => {
      end.lane = lane
    })
  }

  /**
   * appendNote のレーンを右に移動する
   */
  function appendNoteToRight(): void {
    const lane = Math.min(appendNote.value.lane + 1, 5) as LaneType
    appendNote.value.lane = lane
    // TODO: ネスト終点に対応
    appendNote.value.end.forEach((end) => {
      end.lane = lane
    })
  }

  /**
   * appendNote を1ポジション上（先）へ移動する
   */
  function appendNoteToUp(): void {
    const note = appendNote.value
    if (note.split - 1 <= note.position) {
      note.measure++
      note.position = 0
      // 小節切替時に自動追従
      if (isAutoFollow.value && measureData.value[note.measure])
        scrollToMeasure(note.measure)
    } else note.position++
  }

  /**
   * appendNote を1ポジション下（手前）へ移動する
   */
  function appendNoteToDown(): void {
    const note = appendNote.value
    if (note.position === 0) {
      note.measure--
      note.position = note.split - 1
      // 小節切替時に自動追従
      if (isAutoFollow.value) scrollToMeasure(note.measure)
    } else note.position--
  }

  /**
   * appendNote に任意のデータをセットする
   * @param object - セットするノートデータ
   */
  function setAppendNoteInfo(object: NoteData): void {
    appendNote.value = {
      ...appendNote.value,
      ...object,
      index: null,
    }
  }

  /**
   * 仮配置ノートをキャンセルする
   * @param index - キャンセルするノートのインデックス
   */
  function cancelNote(index: number): void {
    preAppendNotes.value = preAppendNotes.value.filter(
      (note: ExtendedNoteData) => note.index !== index
    )
  }

  /**
   * 対象難易度にノーツをコピーする
   * @param targetDifficulty - コピー先の難易度 (null の場合は現在の難易度)
   * @param targets - コピーするノート
   */
  function copyNotesToDifficulty(
    targetDifficulty: DifficultyString | null,
    ...targets: NoteData[]
  ): void {
    insertInto(targetDifficulty || currentDifficulty.value, targets)
    preAppendNotes.value = []
    showSnackbar(`${targets.length}個のノートの挿入を試行しました`)
  }

  /**
   * oldNote が newMeasure 小節に移動した時のノートオブジェクトを返す
   * @param oldNote - 移動元のノート
   * @param newMeasure - 移動先の小節番号
   */
  function getMovedNote(oldNote: NoteData, newMeasure: number): NoteData {
    const diff = newMeasure - oldNote.measure
    return {
      ...oldNote,
      measure: newMeasure,
      end: oldNote.end.map((end) => getMovedNote({ ...end }, end.measure + diff)),
    }
  }

  return {
    appendNote,
    preAppendNotes,
    isAppendMode,
    isAutoFollow,
    getAppendNote,
    appendNoteColorOption,
    appendNotes,
    placeNotes,
    appendSimultaneously,
    addEndToAppendNote,
    deleteEndOfAppendNote,
    changeAppendNoteType,
    appendNoteToLeft,
    appendNoteToRight,
    appendNoteToUp,
    appendNoteToDown,
    setAppendNoteInfo,
    cancelNote,
    copyNotesToDifficulty,
    getMovedNote,
  }
}
