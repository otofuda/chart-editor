import { ref, computed, watch } from 'vue'
import type { NoteData } from 'chart-types'
import type {
  DifficultyString,
  Measure,
  ExtendedNoteData,
  ExtendedChartData,
} from '../types'

const BEAT_HEIGHT_KEY = 'chart-editor__beat-height'

/**
 * 譜面オブジェクトを正規化し、編集に必要な index / isSelected および info を付与する
 * @param raw - 外部またはバックアップから読み込んだ譜面データ
 * @param difficulties - 難易度文字列配列 (デフォルト: ['raku', 'easy', 'normal', 'hard', 'extra'])
 */
export function normalizeChartData(
  raw: Partial<ExtendedChartData> | null | undefined,
  difficulties: DifficultyString[] = ['raku', 'easy', 'normal', 'hard', 'extra']
): ExtendedChartData {
  const result: ExtendedChartData = {
    raku: [],
    easy: [],
    normal: [],
    hard: [],
    extra: [],
    info: {
      version: 2,
      offset: 0,
      bpm: 120,
      beat: 4,
      ...(raw?.info || {}),
    },
  }

  difficulties.forEach((d: DifficultyString) => {
    result[d] = ((raw?.[d] as ExtendedNoteData[]) || []).map((note, idx) => ({
      ...note,
      index: typeof note.index === 'number' ? note.index : idx,
      isSelected: false,
    }))
  })

  return result
}

/**
 * 譜面データ・小節情報・基本計算を管理する composable
 */
export function useChartData() {
  const difficulties: DifficultyString[] = ['raku', 'easy', 'normal', 'hard', 'extra']

  const chartObject = ref<ExtendedChartData>({
    raku: [],
    easy: [],
    normal: [],
    hard: [],
    extra: [],
    info: {
      version: 2,
      offset: 0,
      bpm: 120,
      beat: 4,
    },
  })

  const currentDifficulty = ref<DifficultyString>('easy')

  /** 選択中の難易度の譜面データ配列 */
  const currentChart = computed<ExtendedNoteData[]>(
    () => chartObject.value[currentDifficulty.value] || []
  )

  const musicBpm = computed(() => chartObject.value.info.bpm)
  const musicBeat = computed(() => chartObject.value.info.beat)
  const musicOffset = computed(() => chartObject.value.info.offset)

  /** 譜面中の最大小節番号 */
  const maxMeasure = computed(() => {
    const chart = currentChart.value
    if (chart.length === 0) return 1
    return chart.reduce((max, n) => (n.measure > max ? n.measure : max), 0)
  })

  /** 一拍あたりの高さ (px)、localStorage に永続化 */
  const beatHeight = ref(Number(localStorage.getItem(BEAT_HEIGHT_KEY)) || 100)

  /** 譜面停止をシミュレートするかどうか */
  const isSimulateStop = ref(false)

  watch(beatHeight, (value) => {
    localStorage.setItem(BEAT_HEIGHT_KEY, String(value))
  })

  /** 小節情報を生成する computed */
  const measureData = computed<Measure[]>(() => {
    const data: Measure[] = []
    let measureBeat = musicBeat.value
    let measureBpm = musicBpm.value
    let measureReachTime = musicOffset.value
    let measurePositionBottom =
      (musicOffset.value / ((60 / measureBpm) * 1000)) * beatHeight.value

    // 小節データを生成
    Array.from({ length: maxMeasure.value + 1 }, (_, i) => i).forEach((measure) => {
      // type 97, 98 をfindして拍子/BPM変化を求める
      const beatChangeNote = currentChart.value.find(
        (n) => n.type === 97 && n.measure === measure
      )
      const bpmChangeNote = currentChart.value.find(
        (n) => n.type === 98 && n.measure === measure
      )
      // type 92, 93 をfindして停止/瞬間移動を求める
      const stopNote = currentChart.value.find(
        (n) => n.type === 92 && n.measure === measure
      )
      const warpNote = currentChart.value.find(
        (n) => n.type === 93 && n.measure === measure
      )

      if (beatChangeNote) measureBeat = Number(beatChangeNote.option[0])
      if (bpmChangeNote) measureBpm = Number(bpmChangeNote.option[0])

      // 小節の高さ(px)
      let measureHeight = beatHeight.value * measureBeat
      if (stopNote && isSimulateStop.value) measureHeight = 0
      if (warpNote) measureHeight = beatHeight.value * Number(warpNote.option[0])

      // 小節の長さ(ms)
      let measureLength = (60 / measureBpm) * measureBeat * 1000
      if (warpNote) measureLength = 0 // 瞬間移動小節は 0ms

      data.push({
        measure,
        measureBpm,
        measureBeat,
        measureReachTime,
        measurePositionBottom,
        measureHeight,
        measureLength,
      })

      measureReachTime += measureLength
      measurePositionBottom += measureHeight
    })

    return data
  })

  /**
   * インデックスを指定してノートを削除する
   * @param indices - 削除するノートのインデックス
   */
  function deleteNotes(...indices: number[]): void {
    indices.forEach((i) => {
      chartObject.value[currentDifficulty.value] = currentChart.value.filter(
        (note: ExtendedNoteData) => note.index !== i
      )
    })
  }

  return {
    difficulties,
    chartObject,
    currentDifficulty,
    currentChart,
    musicBpm,
    musicBeat,
    musicOffset,
    maxMeasure,
    beatHeight,
    isSimulateStop,
    measureData,
    deleteNotes,
  }
}
