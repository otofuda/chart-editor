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
        v-for="(note, i) in longNotes"
        :key="`longnote_${i}`"
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
              @click.stop="previewStop"
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
import { ref, computed, inject, onBeforeUnmount } from 'vue'
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
const keybeams = ref<HTMLElement | null>(null)
const currentComboEl = ref<HTMLElement | null>(null)
const handguide = ref<HTMLElement | null>(null)
const LEDLeft = ref<HTMLElement | null>(null)
const LEDRight = ref<HTMLElement | null>(null)
const LEDLeftShadow = ref<HTMLElement | null>(null)
const LEDRightShadow = ref<HTMLElement | null>(null)

const isPreviewing = ref(false)
const returnPosition = ref(-1) // 戻る座標
const currentPosition = ref(0)
const timeoutIds = ref<number[]>([])
const startFrom = ref(0)
const currentMeasure = ref(0)
const currentBpm = ref(0)
const currentBeat = ref(0)
const currentCombo = ref(0) // プレビューするコンボ数
const isShowCheckbox = ref(false)
const isShowKeybeam = ref(false)
const isShowHandguide = ref(false)
const isShowFlickEffect = ref(false)
const isSimulateLED = ref(false)
const isPlayGuide = ref(false)
const eventIds = ref<number[]>([])
let noteEventPlayer: ReturnType<typeof createPreviewEventPlayer> | undefined
const isPlayKeySound = ref(false)
const isPlayKeySoundEnd = ref(false)
const guideAudio = new Audio('/chart-editor/guide.mp3')
const defaultLEDColor = 'linear-gradient(0deg, #ff5151 30%, #44a5ff 70%)'
const lift = ref(Number(localStorage.getItem('chart-editor__lift')) || 0) // LIFTオプション
const sudden = ref(Number(localStorage.getItem('chart-editor__sudden')) || 0) // SUDDENオプション
const hidden = ref(Number(localStorage.getItem('chart-editor__hidden')) || 0) // HIDDENオプション
const comboOffset = ref(60) // コンボ表示位置
const drawOffset = ref(0) // 描画オフセット
const keybeamLength = ref(100) // キービームの長さ
const comboOpacity = ref(50) // コンボ数の透明度
const isObjectBasedPreview = ref(false) // オブジェクト表示モード

import { watch } from 'vue'
watch(lift, (v) => localStorage.setItem('chart-editor__lift', String(v)))
watch(sudden, (v) => localStorage.setItem('chart-editor__sudden', String(v)))
watch(hidden, (v) => localStorage.setItem('chart-editor__hidden', String(v)))

const chart = computed(() => props.currentChart ?? [])
const measures = computed(() => props.measureData ?? [])

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

function playFromMeasure() {
  const _startOffset = startOffset.value
  const audioDelay = (60 / props.infoObject.bpm) * props.infoObject.beat * 1000 // 拍子木分オフセット
  timeoutIds.value.push(setTimeout(() => {
    if (props.previewAudio) {
      props.previewAudio.volume = (props.audioVolume ?? 100) / 100
      props.previewAudio.currentTime = _startOffset / 1000
      props.previewAudio.play()
    }
  }, audioDelay) as unknown as number)

  // let index = 0;
  // let delay = this.previewDelay;
  // this.intervalId = setInterval(() => {
  //   const measure = this.measureData[index] || {};
  //   const next = this.measureData[index + 1] || {};
  //
  //   if (measure.measureReachTime > startOffset) {
  //     this.timeoutIds.append(
  //       setTimeout(() => {
  //         this.currentMeasure = measure.measure;
  //         this.currentPosition = next.measurePositionBottom;
  //         this.currentBpm = measure.measureBpm;
  //         this.currentBeat = measure.measureBeat;
  //         const transitionTime =
  //           next.measureReachTime - measure.measureReachTime;
  //         this.$refs.preview.style.transition = `${transitionTime}ms all linear`;
  //         this.$refs.preview.style.bottom = `-${this.currentPosition}px`;
  //       }, measure.measureReachTime - index * 10 - startOffset)
  //     );
  //   }
  //   index++;
  //   delay -= 10;
  //   console.log(delay);
  //   if (index * 10 + 100 >= this.previewDelay)
  //     clearInterval(this.intervalId);
  // }, 10);
  measures.value.forEach((measure, index) => {
      const next = measures.value[index + 1] as Measure | undefined
    if (measure.measureReachTime > _startOffset) {
      const diff = measure.measureLength === 0 ? -30 : 0
      timeoutIds.value.push(
        setTimeout(() => {
          currentPosition.value = next?.measurePositionBottom ?? 0
          const transitionTime = (next?.measureReachTime ?? 0) - measure.measureReachTime
          const elem = preview.value
          if (!elem) return
          if (measure.measureLength === 0) {
            // 瞬間移動の場合
            elem.style.transition = 'none'
            elem.style.bottom = `-${currentPosition.value}px`
            return
          }
          elem.style.transition = `${transitionTime}ms all linear`
          elem.style.bottom = `-${currentPosition.value}px`
          if (isPlayGuide.value) {
            // 小節ガイド音再生
            guideAudio.currentTime = 0
            guideAudio.play()
          }
        }, measure.measureReachTime - _startOffset + diff) as unknown as number
      )
    }
  })
  setNoteEvents(_startOffset)
}

function playFromZero() {
  timeoutIds.value.push(setTimeout(() => {
    if (props.previewAudio) {
      props.previewAudio.currentTime = 0
      props.previewAudio.volume = (props.audioVolume ?? 100) / 100
      props.previewAudio.play()
    }
  }, (60 / props.infoObject.bpm) * props.infoObject.beat * 1000) as unknown as number)

  // 1小節ずつプレビュー
  measures.value.forEach((measure, index) => {
    const next = measures.value[index + 1] as Measure | undefined
    const diff = measure.measureLength === 0 ? -30 : 0
    timeoutIds.value.push(
      setTimeout(() => {
        currentPosition.value = next?.measurePositionBottom ?? 0
        const transitionTime = (next?.measureReachTime ?? 0) - measure.measureReachTime
        const elem = preview.value
        if (!elem) return
        elem.style.transition = `${transitionTime}ms all linear`
        elem.style.bottom = `-${currentPosition.value}px`
        if (isPlayGuide.value) {
          // 小節ガイド音再生
          guideAudio.currentTime = 0.1
          guideAudio.play()
        }
      }, measure.measureReachTime + diff) as unknown as number
    )
  })
  setNoteEvents(0)
}

// NoteEvents(ノート到達時イベント)をセットする
function setNoteEvents(offset: number) {
  noteEventPlayer?.stop()
  let prevMoveTiming = -500
  let prevMoveTimer: number | null = null
  const _isShowFlickEffect = isShowFlickEffect.value
  const _isShowHandguide = isShowHandguide.value

  noteEventPlayer = createPreviewEventPlayer({
    getKeybeams: () => keybeams.value?.querySelectorAll<HTMLElement>(':scope > div:not(.flick-effect)'),
    isShowKeybeam: () => isShowKeybeam.value,
    isPlayKeySound: () => isPlayKeySound.value,
    isPlayKeySoundEnd: () => isPlayKeySoundEnd.value,
    playSound: () => {
      // 打鍵音を再生
      const keySound = new Audio('/chart-editor/guide.mp3')
      keySound.currentTime = 0.1
      keySound.play()
    },
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
  })
  noteEventPlayer.start(previewEvents.value, offset)
  if (currentComboEl.value) currentComboEl.value.textContent = String(currentCombo.value)
}

function clearPlayback() {
  noteEventPlayer?.stop()
  timeoutIds.value.forEach(id => clearTimeout(id))
  timeoutIds.value = []
  eventIds.value.forEach(id => clearTimeout(id))
  eventIds.value = []
  keybeams.value?.querySelectorAll('.flick-effect').forEach(element => element.remove())
  handguide.value?.classList.remove('-left', '-right', '-up', '-down')
}

function previewStart() {
  if (!measures.value[startFrom.value]) {
    showSnackbar(`${startFrom.value}小節はありません`)
    return false
  }
  clearPlayback()
  returnPosition.value = window.scrollY // 停止後に戻る座標
  isPreviewing.value = true
  currentCombo.value = 0
  if (currentComboEl.value) currentComboEl.value.textContent = String(currentCombo.value)
  const elem = preview.value
  if (elem) {
    elem.style.bottom = `-${measures.value.at(0)?.measurePositionBottom ?? 0}px`
    elem.style.transition = 'none'
  }
  if (startFrom.value === 0) playFromZero()
  else playFromMeasure()
}

function previewStop() {
  if (props.previewAudio) props.previewAudio.pause()
  isPreviewing.value = false
  currentPosition.value = 0
  currentBpm.value = 0
  currentBeat.value = 0
  currentCombo.value = 0
  setLEDColor()
  clearPlayback()
  guideAudio.pause()
  if (preview.value) {
    preview.value.style.transition = '0ms all linear'
    preview.value.style.bottom = '0px'
  }

  if (returnPosition.value >= 0) {
    timeoutIds.value.push(setTimeout(() => {
      window.scrollTo({ top: returnPosition.value, behavior: 'auto' })
      returnPosition.value = -1
    }, 50) as unknown as number)
  }
}

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
  props.previewAudio?.pause()
  guideAudio.pause()
})

const entireHeight = computed(() => {
  const last = measures.value.at(-1)
  return (last?.measurePositionBottom ?? 0) + (last?.measureHeight ?? 0)
})

const startOffset = computed(() => measures.value[startFrom.value]?.measureReachTime ?? 0)

const previewDelay = computed(() => measures.value.length * 10 + 100)
</script>

<style lang="scss" scoped>
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

