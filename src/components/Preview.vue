<template>
  <div>
    <!-- プレビュー(オブジェクト表示) -->
    <div
      v-if="isObjectBasedPreview"
      class="object-based-preview"
      :style="{
        position: 'relative'
      }"
    >
      <!-- 各小節 -->
      <ObjectBasedMeasure
        v-for="measure in measureData"
        :key="`measure_${measure.measure}`"
        :measure="measure"
        :notes="getMeasureNotes(measure.measure)"
        :currentDifficulty="currentDifficulty"
      />
    </div>
    <!-- プレビュー(通常) -->
    <div
      v-else
      class="preview"
      ref="preview"
      :style="{
        position: isPreviewing ? 'fixed' : 'relative',
        bottom: '0px',
        height: `${entireHeight}px`,
        marginBottom: `${lift}px`,
        transform: drawOffset === 0 ? null : `translateY(${drawOffset}px)`
      }"
      :class="{
        detail: isShowDetail,
        capture_mode: isCaptureMode,
        preview_mode: isPreviewMode,
        image_mode: isImageMode,
        checkbox: isShowCheckbox
      }"
    >
      <div
        ref="previewContent"
        class="preview-content"
        :style="{ height: `${entireHeight}px`, willChange: isPreviewing ? 'transform' : null }"
      >
        <!-- 各小節 -->
        <MeasureComponent
          v-for="measure in measureData"
          :key="`measure_${measure.measure}`"
          :measure="measure"
          :notes="getMeasureNotes(measure.measure)"
          :currentDifficulty="currentDifficulty"
        />

        <!-- ロングノーツ -->
        <!-- FIXME: 多分負荷でかい -->
        <LongNote
          v-for="note in longNotes"
          :key="note.index"
          :note="note"
          :measureData="measureData"
        />

        <!-- 配置前のシャドー -->
        <NoteShadow
          v-if="appendNote"
          :note="appendNote"
          :measureData="measureData"
        />

        <!-- 仮配置ノーツ -->
        <NoteShadow
          v-for="(note, i) in preAppendNotes"
          :key="`shadow_${note.measure}_${i}`"
          :note="note"
          :measureData="measureData"
          :isPreAppend="true"
        />
      </div>
    </div>

    <!-- LED -->
    <div
      v-show="!isObjectBasedPreview && !isImageMode"
      class="led left"
      ref="LEDLeft"
    ></div>
    <div
      v-show="!isObjectBasedPreview && !isImageMode"
      class="led right"
      ref="LEDRight"
    ></div>

    <!-- LED(プレビュー時シャドー) -->
    <div
      v-if="!isObjectBasedPreview && isPreviewMode"
      class="led left -s"
      ref="LEDLeftShadow"
    ></div>
    <div
      v-if="!isObjectBasedPreview && isPreviewMode"
      class="led right -s"
      ref="LEDRightShadow"
    ></div>

    <div class="control">
      <v-expansion-panels accordionn tile>
        <v-expansion-panel>
          <v-expansion-panel-title>
            <v-btn
              class="mr-1"
              variant="outlined"
              color="success"
              @click.stop="previewStart"
              :disabled="isPreviewing || isObjectBasedPreview"
            >
              <v-icon left>mdi-play</v-icon> 再生
            </v-btn>
            <v-btn
              class="ml-2 mr-2"
              variant="outlined"
              color="error"
              @click.stop="previewStop()"
            >
              <v-icon left>mdi-stop</v-icon> 停止
            </v-btn>
          </v-expansion-panel-title>

          <v-expansion-panel-text>
            <v-text-field
              class="mb-4"
              v-model.number="startFrom"
              hide-details
              prepend-icon="mdi-numeric-0-box-multiple-outline"
              label="再生開始小節"
              suffix="小節から"
              variant="outlined"
              density="compact"
            ></v-text-field>

            <h4 class="d-flex my-2">
              <v-icon>mdi-music-note</v-icon>
              表示とサウンド
            </h4>
            <v-checkbox
              v-model="isShowCheckbox"
              label="チェックボックスを表示"
              hide-details
              density="compact"
            ></v-checkbox>
            <v-checkbox
              v-model="isPlayKeySound"
              label="打鍵音を再生 (β)"
              hide-details
              density="compact"
            ></v-checkbox>
            <v-checkbox
              v-model="isPlayKeySoundEnd"
              label="LN終点音を再生 (α)"
              hide-details
              density="compact"
            ></v-checkbox>
            <v-checkbox
              v-model="isShowKeybeam"
              label="キービームとコンボを表示"
              density="compact"
              persistent-hint
              hint="以下2つはこの機能が有効でない場合効果がありません"
            ></v-checkbox>
            <v-checkbox
              class="ml-6"
              v-model="isShowFlickEffect"
              :disabled="!isShowKeybeam"
              label="フリックエフェクト (β)"
              hide-details
              density="compact"
            ></v-checkbox>
            <v-checkbox
              class="ml-6"
              v-model="isShowHandguide"
              :disabled="!isShowKeybeam"
              label="LeapMotion補助線をシミュレート (α)"
              hide-details
              density="compact"
            ></v-checkbox>
            <v-checkbox
              v-model="isSimulateLED"
              label="LED制御をシミュレート (β)"
              hide-details
              density="compact"
            ></v-checkbox>
            <v-checkbox
              v-model="isPlayGuide"
              label="小節ガイド音を再生"
              hide-details
              density="compact"
            ></v-checkbox>

            <v-switch
              v-model="isObjectBasedPreview"
              label="Object表示モード"
              hide-details
              density="compact"
            ></v-switch>

            <h4 class="d-flex my-2">
              <v-icon>mdi-tune</v-icon>
              再生オプション
            </h4>
            <v-text-field
              class="my-2"
              v-model.number="lift"
              hint="判定ラインを上に押し上げます"
              persistent-hint
              append-icon="mdi-arrow-collapse-up"
              label="LIFT"
              variant="outlined"
              density="compact"
            ></v-text-field>
            <v-text-field
              class="mb-2"
              v-model.number="sudden"
              hint="譜面領域上部を隠します"
              persistent-hint
              append-icon="mdi-arrow-collapse-down"
              label="SUDDEN"
              variant="outlined"
              density="compact"
            ></v-text-field>
            <v-text-field
              v-model.number="hidden"
              hint="譜面領域下部を隠します"
              persistent-hint
              append-icon="mdi-eye-off"
              label="HIDDEN"
              variant="outlined"
              density="compact"
            ></v-text-field>

            <h4 class="d-flex my-2">
              <v-icon>mdi-tune</v-icon>
              詳細設定
            </h4>

            <v-text-field
              class="mb-2"
              v-model.number="comboOffset"
              hint="判定ラインの上側に移動します"
              persistent-hint
              append-icon="mdi-arrow-up"
              label="コンボ表示位置"
              variant="outlined"
              density="compact"
            ></v-text-field>
            <v-text-field
              class="mb-2"
              v-model.number="drawOffset"
              hint="描画のみ位置をずらします"
              persistent-hint
              append-icon="mdi-arrow-expand-up"
              label="判定位置調整(β)"
              variant="outlined"
              density="compact"
            ></v-text-field>
            <v-text-field
              v-model.number="keybeamLength"
              append-icon="mdi-arrow-expand-vertical"
              label="キービームの長さ"
              suffix="px"
              variant="outlined"
              hide-details
              density="compact"
            ></v-text-field>
            <div class="my-4">
              コンボ数の透明度
            </div>
            <v-slider
              v-model.number="comboOpacity"
              hide-details
              max="100"
              min="0"
              step="5"
              thumb-label="always"
            ></v-slider>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </div>

    <div
      class="lift"
      v-show="isPreviewing"
      :style="{
        height: `${lift}px`
      }"
    ></div>

    <div
      class="sudden"
      v-show="isPreviewing"
      :style="{
        height: `${sudden}px`
      }"
    ></div>

    <div
      class="hidden"
      v-show="isPreviewing"
      :style="{
        height: `${hidden}px`,
        bottom: `${lift - 2}px`
      }"
    ></div>

    <div
      class="combo"
      v-show="isPreviewing && isShowKeybeam"
      :style="{
        opacity: String(Number(comboOpacity) / 100),
        bottom: `${Number(lift) + Number(comboOffset)}px`
      }"
    >
      <strong ref="currentComboEl">0</strong>
      COMBO
    </div>

    <div
      class="keybeams"
      ref="keybeams"
      v-show="isShowKeybeam"
      :style="{
        bottom: `${lift - 2}px`,
        height: `${keybeamLength}px`
      }"
    >
      <div v-for="i in 6" :key="`keybeam${i}`"></div>
    </div>

    <div
      class="handguide"
      v-show="isPreviewing && isShowHandguide"
      ref="handguide"
      :style="{
        bottom: `${lift - 1}px`
      }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onBeforeUnmount, watch } from 'vue'
import {
  type DifficultyString,
  type ExtendedNoteData,
  type Measure,
  type PreviewEvents
} from '../types'

import MeasureComponent from './Measure.vue'
import ObjectBasedMeasure from './ObjectBasedMeasure.vue'
import LongNote from './LongNote.vue'
import NoteShadow from './NoteShadow.vue'
import { showSnackbarKey } from '@/composables/injectionKeys'
import { buildPreviewEvents, createPreviewEventPlayer } from '@/composables/usePreviewEvents'
import { createPreviewPlayback, getPreviewMeasureIndex, getPreviewPosition } from '@/composables/usePreviewPlayback'
import { createPreviewSounds } from '@/composables/usePreviewSounds'
import { readLegacyNumber, usePersistedRef, writeLegacyNumber } from '@/composables/usePersistedRef'

const props = defineProps<{
  currentChart?: ExtendedNoteData[]
  currentDifficulty?: DifficultyString
  measureData?: Measure[]
  previewAudio?: HTMLAudioElement
  audioVolume?: number
  infoObject: { bpm: number; beat: number; offset: number; version: number }
  appendNote?: ExtendedNoteData | null
  preAppendNotes?: ExtendedNoteData[] | null
  isShowDetail?: boolean
  isCaptureMode?: boolean
  isPreviewMode?: boolean
  isImageMode?: boolean
}>()

const showSnackbar = inject(showSnackbarKey)!

// refs for DOM elements
const preview = ref<HTMLElement | null>(null)
const previewContent = ref<HTMLElement | null>(null)
const keybeams = ref<HTMLElement | null>(null)
const currentComboEl = ref<HTMLElement | null>(null)
const handguide = ref<HTMLElement | null>(null)
const LEDLeft = ref<HTMLElement | null>(null)
const LEDRight = ref<HTMLElement | null>(null)
const LEDLeftShadow = ref<HTMLElement | null>(null)
const LEDRightShadow = ref<HTMLElement | null>(null)

const isPreviewing = ref(false)
const returnPosition = ref(-1) // 戻る座標
const timeoutIds = ref<number[]>([])
const startFrom = ref(0)
const currentCombo = ref(0) // プレビューするコンボ数

// 表示とサウンドの設定は、次回の起動時にも復元する。
const isShowCheckbox = usePersistedRef('chart-editor__show-checkbox', false)
const isShowKeybeam = usePersistedRef('chart-editor__show-keybeam', false)
const isShowHandguide = usePersistedRef('chart-editor__show-handguide', false)
const isShowFlickEffect = usePersistedRef('chart-editor__show-flick-effect', false)
const isSimulateLED = usePersistedRef('chart-editor__simulate-led', false)
const isPlayGuide = usePersistedRef('chart-editor__play-guide', false)
const eventIds = ref<number[]>([])
let noteEventPlayer: ReturnType<typeof createPreviewEventPlayer> | undefined
const isPlayKeySound = usePersistedRef('chart-editor__play-key-sound', false)
const isPlayKeySoundEnd = usePersistedRef('chart-editor__play-key-sound-end', false)
const guideSource = new URL('guide.mp3', document.baseURI).href
// 従来と同じ音源内の開始位置を、デコード済みバッファに適用する。
const previewSounds = createPreviewSounds(guideSource, 0.1)
let playbackMeasures: Measure[] = []
let playbackOffset = 0
let eventOffset = 0
let lastChartTime = 0
let previousGuideMeasure = -1
let noteEventOffset = 0
let noteEventsStarted = false
let includeStartEvent = false
let eventsForPlayback: PreviewEvents = {}
const defaultLEDColor = 'linear-gradient(0deg, #ff5151 30%, #44a5ff 70%)'
const lift = ref(readLegacyNumber('chart-editor__lift', 0)) // LIFTオプション
const sudden = ref(readLegacyNumber('chart-editor__sudden', 0)) // SUDDENオプション
const hidden = ref(readLegacyNumber('chart-editor__hidden', 0)) // HIDDENオプション

// 詳細設定は数値として保存し、透明度のみ画面の範囲に制限する。
const comboOffset = usePersistedRef('chart-editor__combo-offset', 60) // コンボ表示位置
const drawOffset = usePersistedRef('chart-editor__draw-offset', 0) // 描画オフセット
const keybeamLength = usePersistedRef('chart-editor__keybeam-length', 100) // キービームの長さ
const comboOpacity = usePersistedRef('chart-editor__combo-opacity', 50, {
  min: 0,
  max: 100,
}) // コンボ数の透明度
const isObjectBasedPreview = usePersistedRef('chart-editor__object-based-preview', false)

// LIFT・SUDDEN・HIDDEN は、既存の保存形式との互換性を保つ。
watch(lift, (v) => writeLegacyNumber('chart-editor__lift', v))
watch(sudden, (v) => writeLegacyNumber('chart-editor__sudden', v))
watch(hidden, (v) => writeLegacyNumber('chart-editor__hidden', v))

const chart = computed(() => props.currentChart ?? [])
const measures = computed(() => props.measureData ?? [])
// 選択状態などの編集用情報を除き、再生内容の変更だけを監視する。
const playbackChartSignature = computed(() => JSON.stringify(chart.value, (key, value) =>
  key === 'index' || key === 'isSelected' ? undefined : value))
const musicOffset = computed(() => {
  const offset = Number(props.infoObject.offset)
  return Number.isFinite(offset) ? offset : 0
})
const musicVolume = computed(() => {
  const volume = Number(props.audioVolume ?? 100)
  return Number.isFinite(volume) ? Math.max(0, Math.min(1, volume / 100)) : 1
})

// 特定小節内のノーツを取得
function getMeasureNotes(measureNumber: number) {
  return chart.value.filter(note => note.measure === measureNumber)
}

function setLEDColor(color?: string) {
  if (LEDLeft.value) LEDLeft.value.style.background = color || defaultLEDColor
  if (LEDRight.value) LEDRight.value.style.background = color || defaultLEDColor
  if (props.isPreviewMode) {
    if (LEDLeftShadow.value) LEDLeftShadow.value.style.background = color || defaultLEDColor
    if (LEDRightShadow.value) LEDRightShadow.value.style.background = color || defaultLEDColor
  }
}

function updatePreview(time: number) {
  lastChartTime = time
  const liveMeasures = measures.value
  if (previewContent.value) {
    const transform = `translate3d(0, ${getPreviewPosition(liveMeasures, time)}px, 0)`
    if (previewContent.value.style.transform !== transform) previewContent.value.style.transform = transform
  }
  if (playback.phase === 'preparing' || playback.phase === 'starting') return
  const eventTime = time - (musicOffset.value - playbackOffset)
  if (eventOffset !== musicOffset.value) {
    if (noteEventsStarted) {
      clearNoteEffects()
      noteEventPlayer?.seek(eventTime)
    }
    previousGuideMeasure = Math.max(previousGuideMeasure, getPreviewMeasureIndex(liveMeasures, time))
    eventOffset = musicOffset.value
  }
  if (!noteEventsStarted && eventTime >= noteEventOffset) {
    noteEventPlayer?.start(eventsForPlayback, noteEventOffset, { includeStart: includeStartEvent })
    noteEventsStarted = true
  }
  if (noteEventsStarted) noteEventPlayer?.update(eventTime)
  if (currentComboEl.value && currentComboEl.value.textContent !== String(currentCombo.value)) {
    currentComboEl.value.textContent = String(currentCombo.value)
  }
  const index = getPreviewMeasureIndex(liveMeasures, time)
  const measure = liveMeasures[index]
  if (index > previousGuideMeasure && measure && time >= measure.measureReachTime) {
    if (isPlayGuide.value && time - measure.measureReachTime <= 50) previewSounds.play()
    previousGuideMeasure = index
  }
}

const playback = createPreviewPlayback({
  onFrame: updatePreview,
  onEnd: () => previewStop(),
  onError(error) {
    previewStop()
    showSnackbar(`プレビューを再生できませんでした: ${error.message}`)
  },
})

// NoteEvents(ノート到達時イベント)をセットする
function setNoteEvents(offset: number) {
  noteEventPlayer?.stop()
  noteEventOffset = offset
  noteEventsStarted = false
  eventsForPlayback = previewEvents.value
  let prevMoveTiming = -500
  let prevMoveTimer: number | null = null
  const _isShowFlickEffect = isShowFlickEffect.value
  const _isShowHandguide = isShowHandguide.value
  const beamElements = keybeams.value?.querySelectorAll<HTMLElement>(':scope > div:not(.flick-effect)')

  noteEventPlayer = createPreviewEventPlayer({
    getKeybeams: () => beamElements,
    isShowKeybeam: () => isShowKeybeam.value,
    isPlayKeySound: () => isPlayKeySound.value,
    isPlayKeySoundEnd: () => isPlayKeySoundEnd.value,
    playSound: previewSounds.play,
    onEvent: event => {
      // フリックエフェクト
      if (isShowKeybeam.value && event.handMove && _isShowFlickEffect && event.noteObject && keybeams.value) {
        const effectDOM = document.createElement('div')
        effectDOM.classList.add('flick-effect', event.handMove)
        keybeams.value.appendChild(effectDOM)
        // 座標計算
        const left = (event.noteObject.lane - 1) * 60 + 30
        let offset = 0
        let width = Number(event.noteObject.option[0]) || 3
        if (event.noteObject.option[1] && event.noteObject.option[2]) {
          offset = (Number(event.noteObject.option[1]) / Number(event.noteObject.option[2])) * 60
        }
        if (width === -1) width = 3
        effectDOM.style.left = `${left - (width / 2) * 60 + offset}px`
        effectDOM.style.width = `${60 * width}px`
        // 消えるタイマーのセット
        eventIds.value.push(setTimeout(() => effectDOM.remove(), 250) as unknown as number)
      }
      // コンボ数
      currentCombo.value += event.count
      if (currentComboEl.value) currentComboEl.value.textContent = String(currentCombo.value)

      // ハンドガイド(手の動き)をシミュレート
      if (_isShowHandguide && handguide.value && event.handMove) {
        const handguideDOM = handguide.value
        handguideDOM.classList.add(event.handMove)
        if (prevMoveTimer && event.timing - prevMoveTiming > 200) clearTimeout(prevMoveTimer)
        prevMoveTimer = setTimeout(() => {
          handguideDOM.classList.remove(event.handMove as string)
        }, 200) as unknown as number
        eventIds.value.push(prevMoveTimer)
        prevMoveTiming = event.timing
      }
      // LEDを指定色に変化
      if (isSimulateLED.value && event.color) setLEDColor(event.color)
    },
    onPastEvent: event => {
      currentCombo.value += event.count
      if (isSimulateLED.value && event.color) setLEDColor(event.color)
    },
    onSeek: color => { if (isSimulateLED.value) setLEDColor(color ?? undefined) },
  })
}

function clearNoteEffects() {
  eventIds.value.forEach(id => clearTimeout(id))
  eventIds.value = []
  keybeams.value?.querySelectorAll('.flick-effect').forEach(element => element.remove())
  handguide.value?.classList.remove('-left', '-right', '-up', '-down')
}

function clearPlayback() {
  playback.stop()
  noteEventPlayer?.stop()
  noteEventsStarted = false
  previewSounds.stop()
  timeoutIds.value.forEach(id => clearTimeout(id))
  timeoutIds.value = []
  clearNoteEffects()
}

function previewStart() {
  const selected = measures.value[startFrom.value]
  if (!selected) {
    showSnackbar(`${startFrom.value}小節はありません`)
    return false
  }
  clearPlayback()
  returnPosition.value = window.scrollY // 停止後に戻る座標
  isPreviewing.value = true
  if (preview.value) preview.value.style.transition = 'none'
  currentCombo.value = 0
  if (currentComboEl.value) currentComboEl.value.textContent = '0'
  setLEDColor()
  previousGuideMeasure = -1
  includeStartEvent = startFrom.value !== 0
  playbackMeasures = measures.value.map(measure => ({ ...measure }))
  playbackOffset = eventOffset = musicOffset.value
  const countInMs = (60 / props.infoObject.bpm) * props.infoObject.beat * 1000
  setNoteEvents(startFrom.value === 0 ? 0 : selected.measureReachTime)
  void playback.start({
    audio: props.previewAudio,
    prepare: isPlayKeySound.value || isPlayGuide.value ? previewSounds.prepare : undefined,
    measures: playbackMeasures,
    startMeasure: startFrom.value,
    countInMs,
    volume: musicVolume.value,
    getEndTime: () => {
      const last = measures.value.at(-1)!
      return last.measureReachTime + last.measureLength
    },
  })
}

function previewStop(restoreScroll = true) {
  const position = returnPosition.value
  returnPosition.value = -1
  isPreviewing.value = false
  currentCombo.value = 0
  if (currentComboEl.value) currentComboEl.value.textContent = '0'
  setLEDColor()
  clearPlayback()
  if (preview.value) {
    preview.value.style.transition = 'none'
    preview.value.style.bottom = '0px'
  }

  previewContent.value?.style.removeProperty('transform')

  if (restoreScroll && position >= 0) {
    timeoutIds.value.push(setTimeout(() => {
      window.scrollTo({ top: position, behavior: 'auto' })
    }, 50) as unknown as number)
  }
}

// srcはDOMの非リアクティブな属性。変更はファイル選択とメディアイベントで検知する。
watch([() => props.previewAudio, () => props.currentChart, playbackChartSignature, () => props.currentDifficulty,
  () => props.infoObject.bpm, () => props.infoObject.beat], () => {
  if (isPreviewing.value) previewStop(false)
})

watch([() => props.measureData, musicOffset], () => {
  if (!isPreviewing.value) return
  const offsetChange = musicOffset.value - playbackOffset
  const sameTimeline = measures.value.length === playbackMeasures.length && measures.value.every((measure, index) => {
    const original = playbackMeasures[index]
    return measure.measure === original.measure && measure.measureBpm === original.measureBpm &&
      measure.measureBeat === original.measureBeat && measure.measureLength === original.measureLength &&
      Math.abs(measure.measureReachTime - original.measureReachTime - offsetChange) < 0.001
  })
  if (sameTimeline) updatePreview(lastChartTime)
  else previewStop(false)
})

watch([() => props.previewAudio, () => props.audioVolume], () => {
  if (props.previewAudio) props.previewAudio.volume = musicVolume.value
}, { immediate: true })

// 再生途中でガイド音を有効にした場合にも、次の小節までに音を準備する。
watch(isPlayGuide, (enabled, _, onCleanup) => {
  if (!enabled || !isPreviewing.value) return
  const player = noteEventPlayer
  let cancelled = false
  onCleanup(() => { cancelled = true })
  void previewSounds.prepare().catch(error => {
    if (!cancelled && isPreviewing.value && noteEventPlayer === player) {
      showSnackbar(`補助音を再生できませんでした: ${error.message}`)
    }
  })
})

// ファイル選択時はデータの変更通知を待たず、スクロール予約も残さずに終了する。
defineExpose({ stop: () => previewStop(false) })

// 全体からロングノーツ（＋ロングのダミー）だけを取得
const longNotes = computed(() =>
  chart.value.filter(note => note.type === 2 || (note.type === 90 && note.option[0] === '2'))
)

// ノートの到達イベント情報を生成
const previewEvents = computed((): PreviewEvents =>
  isPlayKeySound.value || isShowKeybeam.value || isSimulateLED.value
    ? buildPreviewEvents(chart.value, measures.value, defaultLEDColor)
    : {}
)

onBeforeUnmount(() => {
  clearPlayback()
  previewSounds.dispose()
})

const entireHeight = computed(() => {
  const last = measures.value.at(-1)
  return (last?.measurePositionBottom ?? 0) + (last?.measureHeight ?? 0)
})

</script>

<style lang="scss" scoped>
.preview-content {
  position: relative;
}
.preview {
  background: #202020;
  width: 100%;
  width: 420px;
  right: 0;
  margin-left: calc(100% - 420px);
}
.object-based-preview {
  width: 420px;
  margin-left: calc(100% - 420px);
  bottom: unset !important;
  box-sizing: border-box;
}
.control {
  position: fixed;
  top: 0;
  right: 420px;
  padding: 0;
  z-index: 111;
  border-left: 2px solid #a0a0a0;
  border-bottom: 2px solid #a0a0a0;
  max-height: 100vh;
  overflow: scroll;
  scrollbar-width: thin;
}
.led {
  position: fixed;
  top: 0;
  width: 20px;
  height: 100vh;
  background: linear-gradient(0deg, #ff5151 30%, #44a5ff 70%);
  &.left {
    right: 400px;
  }
  &.right {
    right: 0;
  }
  &.-s {
    filter: blur(12px);
  }
}
/* 各種オプション表示用 */
.lift {
  position: fixed;
  bottom: -2px;
  right: 20px;
  width: 380px;
  background: rgba(0, 0, 0, 0.6);
  z-index: 110;
  border-top: 2px solid #ff5151;
}
.sudden {
  position: fixed;
  top: 0;
  right: 20px;
  width: 380px;
  background: #505050;
  z-index: 110;
}
.hidden {
  position: fixed;
  right: 20px;
  width: 380px;
  background: #505050;
  z-index: 110;
}
.combo {
  position: fixed;
  bottom: 50px;
  right: 20px;
  width: 380px;
  text-align: center;
  color: #f0f0f0;
  font-size: 20px;
  z-index: 112;
  > strong {
    display: block;
    font-size: 50px;
  }
}
.handguide {
  position: fixed;
  bottom: 0;
  right: 209px;
  width: 2px;
  height: 400px;
  text-align: center;
  background: #ffc2df;
  background: linear-gradient(0deg, #ffc2df88 0%, #ffc2df00 100%);
  opacity: 0.7;
  font-size: 20px;
  z-index: 111;
  transition: 0.2s all ease-out;
  &.-left {
    transform: skewX(4deg) translateX(-12vh);
    transition: 0.2s all ease-out;
  }
  &.-right {
    transform: skewX(-4deg) translateX(12vh);
    transition: 0.2s all ease-out;
  }
}
.keybeams {
  position: fixed;
  bottom: 0px;
  right: 60px;
  width: 300px;
  display: flex;
  > div {
    flex-grow: 1;
    opacity: 0;
    transition: 0.1s all linear;
    background: linear-gradient(#16d5f700 0%, #16d5f790 100%);
    &:first-child {
      position: absolute;
      top: 0;
      height: 100%;
      width: 300px;
      transition: 0.2s all linear;
      background: linear-gradient(#f7d51600 0%, #f7d51690 100%);
      transform-origin: bottom center;
      transform: scaleY(1.5);
      &.-on {
        transform: scaleY(1);
      }
    }
    &.-on {
      opacity: 1;
      transition: none;
    }
    &.-hold {
      opacity: 1;
      transition: none;
    }
  }
}
</style>

