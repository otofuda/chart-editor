<!-- eslint-disable vue/no-mutating-props -->
<template>
  <!-- note/endはtype 1, 2のみ想定 -->
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
      {{ note.position }}/{{ note.split }}
      <span v-if="isPreAppend" class="preappend__index">#{{ note.index }}</span>
    </span>

    <div v-for="(end, i) in note.end" :key="i">
      <!-- 終点 -->
      <span
        class="note"
        :class="{
          [`type${end.type}`]: true,
          shadow: !isPreAppend,
          preappend: isPreAppend
        }"
        :style="{
          left: `${getAbsoluteLeft(end)}px`,
          bottom: `${getAbsoluteBottom(end)}px`,
          width: `${getWidth(end)}px`
        }"
      >
        {{ end.position }}/{{ end.split }}
      </span>
      <!-- 帯 -->
      <i
        class="note-hold"
        :class="{
          shadow: !isPreAppend,
          preappend: isPreAppend
        }"
        :style="{
          bottom: `${getAbsoluteBottom(note)}px`,
          left: `${getAbsoluteLeft(end)}px`,
          height: `${getAbsoluteBottom(end) - getAbsoluteBottom(note)}px`
        }"
      ></i>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { type ExtendedNoteData, type Measure } from '@/types'
import { cancelNoteKey } from '@/composables/injectionKeys'

const props = defineProps<{
  note: ExtendedNoteData
  measureData: Measure[]
  isPreAppend?: boolean // 仮配置ノートかどうか
}>()

const cancelNote = inject(cancelNoteKey)!

function getLeft(note: ExtendedNoteData) {
  // 引数のノートの描画用typeとoption配列を取得
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

function getAbsoluteLeft(note: ExtendedNoteData) {
  return getLeft(note) + 60
}

function getBottom(note: ExtendedNoteData) {
  const targetMeasure = props.measureData[note.measure] || props.measureData.at(-1)!
  return (note.position / note.split) * targetMeasure.measureHeight
}

function getAbsoluteBottom(note: ExtendedNoteData) {
  const targetMeasure = props.measureData[note.measure]
  if (targetMeasure) {
    return targetMeasure.measurePositionBottom + (note.position / note.split) * targetMeasure.measureHeight
  } else {
    const lastMeasure = props.measureData.at(-1)!
    const diff = note.measure - lastMeasure.measure
    return diff * lastMeasure.measureHeight + lastMeasure.measurePositionBottom + (note.position / note.split) * lastMeasure.measureHeight
  }
}

function getWidth(note: ExtendedNoteData) {
  // 引数のノートの描画用typeとoption配列を取得
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
