<!-- eslint-disable vue/no-mutating-props -->
<template>
  <div :class="{ 'draft-shadow': isEditable, 'note-draggable': isEditable }">
    <!-- 始点 -->
    <span
      class="note"
      :class="{
        [`type${drawType}`]: true,
        isDummy: note.type === 90,
        shadow: !isPreAppend,
        preappend: isPreAppend
      }"
      :style="{
        left: `${getAbsoluteLeft(note)}px`,
        bottom: `${getAbsoluteBottom(note)}px`,
        width: `${getWidth(note)}px`,
        background: dispColor
      }"
      @pointerdown="startNodeDrag($event)"
      @click="handleRootClick"
    >
      <!-- テクスチャの時 -->
      <img
        v-if="drawType === 94"
        :src="textureSrc"
        :style="{
          height: `${textureHeight}px`
        }"
        alt="texture"
        :draggable="false"
      />

      <!-- コメントの時 -->
      <v-icon v-if="drawType === 100" color="warning" class="mt-2">
        mdi-comment
      </v-icon>
      <v-textarea
        outlined
        bg-color="editor-highlight"
        v-if="drawType === 100"
        :model-value="drawOptions[0] ?? ''"
        class="elevation-4"
        hide-details
        disabled
      ></v-textarea>
      <strong v-if="noteSpeed !== 1" class="speed">x{{ noteSpeed }}</strong>
      <strong v-if="noteOrbit !== 0" class="orbit">&gt;{{ noteOrbit }}</strong>
      <strong v-if="drawType === 97">BEAT {{ drawOptions[0] }}</strong>
      {{ note.position }}/{{ note.split }}
      <strong v-if="drawType === 91">SpObj</strong>
      <strong v-if="drawType === 92">STOP</strong>
      <strong v-if="drawType === 93">WARP {{ drawOptions[0] }}</strong>
      <strong v-if="drawType === 98">BPM {{ drawOptions[0] }}</strong>
      <strong v-if="drawType === 99">EOF</strong>
      <span v-if="isPreAppend" class="preappend__index">#{{ note.index }}</span>
    </span>

    <!-- 終点ノーツ（再帰全ノード） -->
    <template v-for="ep in treeData.endpoints" :key="ep.id">
      <!-- 中継点かつ type: 1 の場合は小さな〇（コンボ加算中点） -->
      <span
        v-if="ep.isIntermediate && ep.note.type === 1"
        class="note-midpoint"
        :class="{
          shadow: !isPreAppend,
          preappend: isPreAppend
        }"
        :style="{
          left: `${(ep.note.lane - 1) * 60 + 85}px`,
          bottom: `${getAbsoluteBottom(ep.note) - 5}px`
        }"
        @pointerdown="startNodeDrag($event, ep.note)"
      >
        <span class="midpoint-badges">
          <strong v-if="Number(ep.note.option?.[0]) && Number(ep.note.option?.[0]) !== 1" class="speed">x{{ ep.note.option[0] }}</strong>
          <strong v-if="Number(ep.note.option?.[1]) && Number(ep.note.option?.[1]) !== 0" class="orbit">&gt;{{ ep.note.option[1] }}</strong>
        </span>
      </span>
      <!-- 末端終点（type !== 89）の場合は通常のノートバー -->
      <span
        v-else-if="!ep.isIntermediate && ep.note.type !== 89"
        class="note"
        :class="{
          [`type${ep.note.type}`]: true,
          shadow: !isPreAppend,
          preappend: isPreAppend
        }"
        :style="{
          left: `${getAbsoluteLeft(ep.note, true)}px`,
          bottom: `${getAbsoluteBottom(ep.note)}px`,
          width: `${getWidth(ep.note, true)}px`
        }"
        @pointerdown="startNodeDrag($event, ep.note)"
      >
        <strong v-if="Number(ep.note.option?.[0]) && Number(ep.note.option?.[0]) !== 1" class="speed">x{{ ep.note.option[0] }}</strong>
        <strong v-if="Number(ep.note.option?.[1]) && Number(ep.note.option?.[1]) !== 0" class="orbit">&gt;{{ ep.note.option[1] }}</strong>
        {{ ep.note.position }}/{{ ep.note.split }}
      </span>
      <!-- 不可視ノード（type: 89）だが speed または orbit が指定されている場合はバッジのみ表示 -->
      <span
        v-else-if="hasSpeedOrOrbit(ep.note)"
        class="note-invisible-badge"
        :class="{
          shadow: !isPreAppend,
          preappend: isPreAppend
        }"
        :style="{
          left: `${getAbsoluteLeft(ep.note, true)}px`,
          bottom: `${getAbsoluteBottom(ep.note)}px`,
          width: `${getWidth(ep.note, true)}px`
        }"
        @pointerdown="startNodeDrag($event, ep.note)"
      >
        <strong v-if="Number(ep.note.option?.[0]) && Number(ep.note.option?.[0]) !== 1" class="speed">x{{ ep.note.option[0] }}</strong>
        <strong v-if="Number(ep.note.option?.[1]) && Number(ep.note.option?.[1]) !== 0" class="orbit">&gt;{{ ep.note.option[1] }}</strong>
      </span>

      <span
        v-if="isEditable && isLongDraft && ep.note.type === 89"
        class="draft-invisible-handle"
        :class="{ 'touch-visible': showHandles }"
        :style="{
          left: `${(ep.note.lane - 1) * 60 + 78}px`,
          bottom: `${getAbsoluteBottom(ep.note) - 12}px`
        }"
        aria-label="配置前の不可視の中点・終点"
        @pointerdown="startInvisibleDrag($event, ep.note)"
        @click="!showHandles && handleRootClick()"
      >
        <span />
      </span>
    </template>

    <!-- 帯（SVGパス） -->
    <svg
      v-if="treeData.segments.length > 0"
      class="long-note-svg"
      :class="{
        shadow: !isPreAppend,
        preappend: isPreAppend
      }"
      :style="{
        height: `${entireHeight}px`
      }"
      @pointerdown="startWholeDrag"
      @click="isEditable && handleRootClick()"
    >
      <g v-for="seg in treeData.segments" :key="seg.id">
        <path :d="seg.paths.fillPath" class="hold-fill" />
        <path :d="seg.paths.leftBorderPath" class="hold-border" />
        <path :d="seg.paths.rightBorderPath" class="hold-border" />
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { type ExtendedNoteData, type Measure } from '@/types'
import type { NoteData } from 'chart-types'
import { cancelNoteKey } from '@/composables/injectionKeys'
import { getCurveType, generateHoldSvgPaths, type CurveType } from '@/composables/useNoteTypes'
import { noteDragKey } from '@/composables/useNoteDrag'
import { effectiveNoteType } from '@/composables/noteMovement'
import { getNoteMotion } from '@/composables/usePreviewNoteMotion'

const props = defineProps<{
  note: ExtendedNoteData
  measureData: Measure[]
  isPreAppend?: boolean // 仮配置ノートかどうか
  /** 配置欄と連動するシャドーだけ、ドラッグと不可視点の操作を有効にする。 */
  isDraggable?: boolean
}>()

const cancelNote = inject(cancelNoteKey)!
const noteDrag = inject(noteDragKey, null)
const isEditable = computed(() =>
  Boolean(props.isDraggable && !props.isPreAppend && noteDrag?.enabled.value),
)
const showHandles = ref(false)
const isLongDraft = computed(() => effectiveNoteType(props.note) === 2)
let pointerType = 'mouse'

/** 配置前の始点・中点・終点を、共通のドラッグ処理へ渡す。 */
function startNodeDrag(event: PointerEvent, node: NoteData = props.note): void {
  if (!isEditable.value) {
    return
  }

  pointerType = event.pointerType
  noteDrag?.start(event, props.note, node)
}

/** 配置前の帯から、分岐を含めたロング全体の移動を開始する。 */
function startWholeDrag(event: PointerEvent): void {
  if (!isEditable.value) {
    return
  }

  pointerType = event.pointerType
  noteDrag?.startWhole(event, props.note)
}

/** マウス併用端末でも、表示前の不可視点へのタッチは帯の操作として扱う。 */
function startInvisibleDrag(event: PointerEvent, node: NoteData): void {
  if (event.pointerType === 'touch' && !showHandles.value) {
    startWholeDrag(event)
  } else {
    startNodeDrag(event, node)
  }
}

/** 仮配置済みノーツの取消、または配置前ロングのタッチ用ハンドル切替を処理する。 */
function handleRootClick(): void {
  if (props.isPreAppend) {
    cancelNote(props.note.index)
  } else if (
    isEditable.value &&
    isLongDraft.value &&
    pointerType === 'touch'
  ) {
    showHandles.value = !showHandles.value
  }
}

// 別の配置対象や種類へ切り替えたときは、不可視点のタップ選択を解除する。
watch(
  [
    () => props.note,
    () => props.note.type,
    isLongDraft,
    isEditable,
  ],
  () => {
    showHandles.value = false
  },
  { flush: 'sync' },
)

function hasSpeedOrOrbit(note: NoteData): boolean {
  const s = Number(note.option?.[0])
  const o = Number(note.option?.[1])
  return Boolean((s && s !== 1) || (o && o !== 0))
}

const entireHeight = computed(() => {
  const last = props.measureData.at(-1)
  return (last?.measurePositionBottom ?? 0) + (last?.measureHeight ?? 0)
})

/**
 * 分数指定の横オフセット（px）を計算する。
 * 分母が0や非数値のときは0を返し、不正なCSS座標を防ぐ。
 */
function getOptionOffset(numerValue: string | undefined, denomValue: string | undefined): number {
  const numer = Number(numerValue)
  const denom = Number(denomValue)

  if (!Number.isFinite(numer) || !Number.isFinite(denom) || !numer || !denom) {
    return 0
  }

  return (numer / denom) * 60
}

/** ロングの帯に接続する各ノードのレーン幅倍率を返す。始点（ダミー含む）は常に1とする。 */
function getHoldNodeWidth(n: NoteData | ExtendedNoteData): number {
  const nodeDrawType = n.type === 90 ? Number(n.option[0]) : n.type

  if (nodeDrawType === 2) {
    return 1
  }

  const nodeOptions = n.type === 90 ? n.option.slice(1) : n.option
  const width = Number(nodeOptions?.[3])

  if (!width || Number.isNaN(width) || width <= 0 || width === -1) {
    return 1
  }

  return width
}

/**
 * ノーツの左端座標（レーン領域基準・px）を返す。
 * 単体通常ノーツ（type: 1）ではwidthオプションを適用せず、ロングの終点・中点のみ適用する。
 */
function getLeft(note: NoteData | ExtendedNoteData, isEndpoint = false) {
  const nodeDrawType = note.type === 90 ? Number(note.option[0]) : note.type
  const nodeOptions = note.type === 90 ? note.option.slice(1) : note.option

  // TAP, ロング, 終点, 区切り線, コメント
  if ([1, 2, 89, 95, 100].includes(nodeDrawType)) {
    if (isEndpoint && [1, 89].includes(nodeDrawType) && nodeOptions?.[3]) {
      let width = Number(nodeOptions[3]) || 1

      if (width === -1 || width <= 0) {
        width = 1
      }

      const center = (note.lane - 1) * 60 + 30
      return center - (width / 2) * 60
    }

    return (note.lane - 1) * 60
  }

  // 左右フリック, 上下フリック
  if ([3, 4, 6, 7].includes(nodeDrawType)) {
    let width = Number(nodeOptions[0]) || 3

    if (width === -1) {
      width = 3
    }

    const center = (note.lane - 1) * 60 + 30
    const offset = getOptionOffset(nodeOptions[1], nodeOptions[2])
    return center - (width / 2) * 60 + offset
  }

  // テクスチャ
  if (nodeDrawType === 94) {
    const width = Number(nodeOptions[1]) || 1
    const center = (note.lane - 1) * 60 + 30
    const offset = getOptionOffset(nodeOptions[3], nodeOptions[4])
    return center - (width / 2) * 60 + offset
  }

  // LED制御
  if (nodeDrawType === 96) {
    return -50
  }

  // 音札, その他特殊ノーツ
  return 0
}

/** 小節左の余白60pxを含めた、譜面領域内の左端座標（px）を返す。 */
function getAbsoluteLeft(note: NoteData | ExtendedNoteData, isEndpoint = false) {
  return getLeft(note, isEndpoint) + 60
}

function getAbsoluteBottom(note: NoteData | ExtendedNoteData) {
  const targetMeasure = props.measureData[note.measure]
  if (targetMeasure) {
    return targetMeasure.measurePositionBottom + (note.position / note.split) * targetMeasure.measureHeight
  } else {
    const lastMeasure = props.measureData.at(-1)
    if (!lastMeasure) return 0
    const diff = note.measure - lastMeasure.measure
    return diff * lastMeasure.measureHeight + lastMeasure.measurePositionBottom + (note.position / note.split) * lastMeasure.measureHeight
  }
}

/**
 * ノーツの表示幅（px）を返す。
 * 単体通常ノーツ（type: 1）ではwidthオプションを適用せず、ロングの終点・中点のみ適用する。
 */
function getWidth(note: NoteData | ExtendedNoteData, isEndpoint = false) {
  const nodeDrawType = note.type === 90 ? Number(note.option[0]) : note.type
  const nodeOptions = note.type === 90 ? note.option.slice(1) : note.option

  // TAP, ロング, 終点, コメント
  if ([1, 2, 89, 100].includes(nodeDrawType)) {
    if (isEndpoint && [1, 89].includes(nodeDrawType) && nodeOptions?.[3]) {
      let width = Number(nodeOptions[3]) || 1

      if (width === -1 || width <= 0) {
        width = 1
      }

      return 60 * width
    }

    return 60
  }

  // 左右フリック, 上下フリック
  if ([3, 4, 6, 7].includes(nodeDrawType)) {
    let width = Number(nodeOptions[0]) || 3

    if (width === -1) {
      width = 3
    }

    return 60 * width
  }

  // テクスチャ
  if (nodeDrawType === 94) {
    const width = Number(nodeOptions[1]) || 1
    return 60 * width
  }

  // 区切り線
  if (nodeDrawType === 95) {
    let width = Number(nodeOptions[0]) || 1

    if (width === -1) {
      width = 1
    }

    if (note.position === 0) {
      width = 5
    }

    return 60 * width
  }

  // LED制御
  if (nodeDrawType === 96) {
    return 40
  }

  // その他
  return 300
}

interface HoldSegment {
  id: string
  parent: NoteData
  child: NoteData
  curveType: CurveType
  paths: { fillPath: string; leftBorderPath: string; rightBorderPath: string }
}

interface EndPointNode {
  id: string
  note: NoteData
  parent: NoteData
  depth: number
  index: number
  isIntermediate: boolean
}

const treeData = computed(() => {
  const segments: HoldSegment[] = []
  const endpoints: EndPointNode[] = []

  /** 分岐の経路を識別子に使い、位置が変わっても描画要素の対応を保つ。 */
  function traverse(parent: NoteData, depth: number, parentId = 'shadow_root') {
    if (!parent.end || !Array.isArray(parent.end)) return

    parent.end.forEach((child, idx) => {
      const childId = `${parentId}_${idx}`
      const isIntermediate = Boolean(child.end && Array.isArray(child.end) && child.end.length > 0)
      endpoints.push({
        id: childId,
        note: child,
        parent,
        depth,
        index: idx,
        isIntermediate,
      })

      const x1 = (parent.lane - 1) * 60 + 60 + 30
      const b1 = getAbsoluteBottom(parent)
      const x2 = (child.lane - 1) * 60 + 60 + 30
      const b2 = getAbsoluteBottom(child)

      const y1 = entireHeight.value - b1
      const y2 = entireHeight.value - b2
      const curveType = getCurveType(child)

      const w1 = getHoldNodeWidth(parent) * 38
      const w2 = getHoldNodeWidth(child) * 38

      const paths = generateHoldSvgPaths(x1, y1, x2, y2, curveType, w1, w2)
      segments.push({
        id: `shadow_seg_${childId}`,
        parent,
        child,
        curveType,
        paths,
      })

      traverse(child, depth + 1, childId)
    })
  }

  traverse(props.note, 1)
  return { segments, endpoints }
})

/** 描画用のノート種別。ダミー時は擬態対象の種別を返す。 */
const drawType = computed(() => {
  if (props.note.type === 90) {
    return Number(props.note.option[0])
  }

  return props.note.type
})

/** 描画用のオプション配列。ダミー時は先頭の擬態先種別を除いた配列を返す。 */
const drawOptions = computed(() => {
  if (props.note.type === 90) {
    return props.note.option.slice(1)
  }

  return props.note.option
})

/** ノート種別ごとの定義に従って読み取った速度と軌道。 */
const noteMotion = computed(() => getNoteMotion(props.note))

/** 始点・単独ノーツの速度バッジ表示値。既定値（1）のときは非表示にする。 */
const noteSpeed = computed(() => noteMotion.value?.speed ?? 1)

/** 始点・単独ノーツの軌道バッジ表示値。既定値（0）のときは非表示にする。 */
const noteOrbit = computed(() => noteMotion.value?.orbit ?? 0)

/** テクスチャノーツの表示用画像URL。相対パスはOtofuda DBのURLへ補完する。 */
const textureSrc = computed(() => {
  const source = drawOptions.value[0] ?? ''

  if (String(source).startsWith('texture')) {
    return `https://db.otofuda.com/${source}`
  }

  return source
})

/** テクスチャノーツの表示高さ（px）。対象小節が存在しない場合は末尾小節を基準にする。 */
const textureHeight = computed(() => {
  const targetMeasure = props.measureData[props.note.measure] ?? props.measureData.at(-1)
  const measureHeight = targetMeasure?.measureHeight ?? 0
  const scale = Number(drawOptions.value[2])

  if (!Number.isFinite(scale)) {
    return 0
  }

  return measureHeight * scale
})

/** LED制御ノーツの背景色。ダミーで擬態している場合もdrawOptionsから解決する。 */
const dispColor = computed(() => {
  if (drawType.value !== 96) {
    return null
  }

  const [red, green, blue] = drawOptions.value

  if (Number(red) === -1 && Number(green) === -1 && Number(blue) === -1) {
    return 'linear-gradient(0deg, #ff5151 20%, #44a5ff 80%)'
  }

  return `rgb(${red},${green},${blue})`
})
</script>

<style lang="scss" scoped>
.shadow {
  color: #909090;
  animation: blink 0.5s infinite;
  // 表示専用のシャドーは、重なった既存ノーツへの入力を遮らない。
  pointer-events: none;
}

// 配置欄のシャドーだけ既存ノーツより前面で入力を受け取り、表示専用の候補は透過する。
.draft-shadow {
  .note,
  .note-midpoint,
  .note-invisible-badge {
    z-index: 107;
    pointer-events: auto;
    cursor: grab;
  }

  .long-note-svg {
    z-index: 106;
    pointer-events: none;

    .hold-fill {
      pointer-events: visibleFill;
      cursor: grab;
    }

    .hold-border {
      pointer-events: visibleStroke;
      cursor: grab;
    }
  }
}

.draft-invisible-handle {
  position: absolute;
  z-index: 108;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  cursor: grab;
  pointer-events: none;

  > span {
    width: 10px;
    height: 10px;
    border: 2px solid #6ecc6e;
    background: #303030;
    transform: rotate(45deg);
    opacity: 0;
  }

  @media (hover: hover) {
    pointer-events: auto;

    &:hover > span {
      opacity: 1;
    }
  }

  &.touch-visible {
    pointer-events: auto;

    > span {
      opacity: 1;
    }
  }
}

.preappend {
  opacity: 1;
  color: rgba(255, 255, 255, 0.5) !important;
  transition: none;
  box-shadow: 0 0 4px 4px rgba(255, 255, 0, 0.25);
  cursor: pointer;
  &__index {
    display: block;
    color: limegreen;
    line-height: 10px;
  }
}
.type94 .preappend__index {
  position: absolute;
  right: 0;
  top: 0;
}

@keyframes blink {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 1;
  }
  51% {
    opacity: 0.5;
  }
  100% {
    opacity: 0.5;
  }
}
</style>
