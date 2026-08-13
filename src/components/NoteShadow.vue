<!-- eslint-disable vue/no-mutating-props -->
<template>
  <div>
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
      @click="calcelThisNote"
    >
      <!-- テクスチャの時 -->
      <img
        v-if="note.type === 94"
        :src="
          String(note.option[0]).startsWith('texture')
          ? `https://db.otofuda.com/${note.option[0]}`
          : note.option[0]
        "
        :style="{
          height: `${measureData.at(-1)?.measureHeight * Number(note.option[2])}px`
        }"
        alt="texture"
      />

      <!-- コメントの時 -->
      <v-icon v-if="note.type === 100" color="warning" class="mt-2">
        mdi-comment
      </v-icon>
      <v-textarea
        outlined
        background-color="amber lighten-4"
        v-if="note.type === 100"
        v-model="note.option[0]"
        class="elevation-4"
        hide-details
        disabled
      ></v-textarea>
      <strong v-if="Number(note.option?.[0]) && Number(note.option?.[0]) !== 1" class="speed">x{{ note.option[0] }}</strong>
      <strong v-if="Number(note.option?.[1]) && Number(note.option?.[1]) !== 0" class="orbit">&gt;{{ note.option[1] }}</strong>
      {{ note.position }}/{{ note.split }}
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
          left: `${getAbsoluteLeft(ep.note) + 25}px`,
          bottom: `${getAbsoluteBottom(ep.note) - 5}px`
        }"
        :title="getNoteTooltip(ep.note)"
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
          left: `${getAbsoluteLeft(ep.note)}px`,
          bottom: `${getAbsoluteBottom(ep.note)}px`,
          width: `${getWidth(ep.note)}px`
        }"
        :title="getNoteTooltip(ep.note)"
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
          left: `${getAbsoluteLeft(ep.note)}px`,
          bottom: `${getAbsoluteBottom(ep.note)}px`,
          width: `${getWidth(ep.note)}px`
        }"
        :title="getNoteTooltip(ep.note)"
      >
        <strong v-if="Number(ep.note.option?.[0]) && Number(ep.note.option?.[0]) !== 1" class="speed">x{{ ep.note.option[0] }}</strong>
        <strong v-if="Number(ep.note.option?.[1]) && Number(ep.note.option?.[1]) !== 0" class="orbit">&gt;{{ ep.note.option[1] }}</strong>
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
import { computed, inject } from 'vue'
import type { NoteData } from 'chart-types'
import { type ExtendedNoteData, type Measure } from '@/types'
import { cancelNoteKey } from '@/composables/injectionKeys'
import { generateHoldSvgPaths, getCurveType, type CurveType } from '@/composables/useNoteTypes'

const props = defineProps<{
  note: ExtendedNoteData
  measureData: Measure[]
  isPreAppend?: boolean // 仮配置ノートかどうか
}>()

const cancelNote = inject(cancelNoteKey)!

function hasSpeedOrOrbit(note: NoteData): boolean {
  const s = Number(note.option?.[0])
  const o = Number(note.option?.[1])
  return Boolean((s && s !== 1) || (o && o !== 0))
}

function getNoteTooltip(note: NoteData): string {
  let text = `${note.position}/${note.split}`
  if (note.option?.[0] && Number(note.option[0]) !== 1) text += ` (speed: x${note.option[0]})`
  if (note.option?.[1] && Number(note.option[1]) !== 0) text += ` (orbit: >${note.option[1]})`
  return text
}

const entireHeight = computed(() => {
  const last = props.measureData.at(-1)
  return (last?.measurePositionBottom ?? 0) + (last?.measureHeight ?? 0)
})

function getLeft(note: NoteData | ExtendedNoteData) {
  const drawType = (note.type === 90) ? Number(note.option[0]) : note.type
  const drawOptions = (note.type === 90) ? note.option.slice(1) : note.option
  // TAP, ロング, 終点, 区切り線, コメント
  if ([1, 2, 89, 95, 100].includes(drawType)) return (note.lane - 1) * 60
  // 左右フリック, 上下フリック
  else if ([3, 4, 6, 7].includes(drawType)) {
    let _width = Number(drawOptions[0]) || 3
    if (_width === -1) _width = 3
    const _left = (note.lane - 1) * 60 + 30
    let _offset = 0
    if (drawOptions[1] && drawOptions[2]) _offset = (Number(drawOptions[1]) / Number(drawOptions[2])) * 60
    return _left - (_width / 2) * 60 + _offset
  // テクスチャ
  } else if (drawType === 94) {
    let _width = Number(drawOptions[1]) || 1
    const _left = (note.lane - 1) * 60 + 30
    let _offset = 0
    if (drawOptions[3] && drawOptions[4]) _offset = (Number(drawOptions[3]) / Number(drawOptions[4])) * 60
    return _left - (_width / 2) * 60 + _offset
  // LED制御
  } else if (drawType === 96) return -50
  // 音札, その他特殊ノーツ
  else return 0
}

function getAbsoluteLeft(note: NoteData | ExtendedNoteData) {
  return getLeft(note) + 60
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

function getWidth(note: NoteData | ExtendedNoteData) {
  const drawType = (note.type === 90) ? Number(note.option[0]) : note.type
  const drawOptions = (note.type === 90) ? note.option.slice(1) : note.option
  // TAP, ロング, 終点, コメント
  if ([1, 2, 89, 100].includes(drawType)) return 60
  // 左右フリック, 上下フリック
  else if ([3, 4, 6, 7].includes(drawType)) {
    let _width = Number(drawOptions[0]) || 3
    if (_width === -1) _width = 3
    return 60 * _width
  // テクスチャ
  } else if (drawType === 94) {
    let _width = Number(drawOptions[1]) || 1
    return 60 * _width
  // 区切り線
  } else if (drawType === 95) {
    let _width = Number(drawOptions[0]) || 1
    if (_width === -1) _width = 1
    if (note.position === 0) _width = 5
    return 60 * _width
  // LED制御
  } else if (drawType === 96) return 40
  // その他
  else return 300
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

  function traverse(parent: NoteData, depth: number) {
    if (!parent.end || !Array.isArray(parent.end)) return

    parent.end.forEach((child, idx) => {
      const childId = `shadow_end_${depth}_${idx}_${child.measure}_${child.position}`
      const isIntermediate = Boolean(child.end && Array.isArray(child.end) && child.end.length > 0)
      endpoints.push({
        id: childId,
        note: child,
        parent,
        depth,
        index: idx,
        isIntermediate,
      })

      const x1 = getAbsoluteLeft(parent) + 30
      const b1 = getAbsoluteBottom(parent)
      const x2 = getAbsoluteLeft(child) + 30
      const b2 = getAbsoluteBottom(child)

      const y1 = entireHeight.value - b1
      const y2 = entireHeight.value - b2
      const curveType = getCurveType(child)

      const paths = generateHoldSvgPaths(x1, y1, x2, y2, curveType, 38)
      segments.push({
        id: `shadow_seg_${childId}`,
        parent,
        child,
        curveType,
        paths,
      })

      traverse(child, depth + 1)
    })
  }

  traverse(props.note, 1)
  return { segments, endpoints }
})

function calcelThisNote() {
  if (props.isPreAppend) cancelNote(props.note.index)
}

const dispColor = computed(() => {
  if (props.note.type === 96) {
    if (Number(props.note.option[0]) === -1 && Number(props.note.option[1]) === -1 && Number(props.note.option[2]) === -1) {
      return 'linear-gradient(0deg, #ff5151 20%, #44a5ff 80%)'
    } else return `rgb(${props.note.option[0]},${props.note.option[1]},${props.note.option[2]})`
  }
  return null
})

const drawType = computed(() => {
  if (props.note.type === 90) return Number(props.note.option[0])
  return props.note.type
})
</script>

<style lang="scss" scoped>
.shadow {
  color: #909090;
  animation: blink 0.5s infinite;
  &:active {
    transform: scale(1.5);
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
