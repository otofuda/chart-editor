<!-- eslint-disable vue/no-mutating-props -->
<template>
  <v-menu
    v-model="menu"
    :close-on-content-click="false"
    location="left"
    :max-width="420"
    :target="menuTarget"
    :location-strategy="locationStrategy"
  >
    <template v-slot:activator="{ props }">
      <!-- 始点 -->
      <span
        class="note"
        :class="{
          [`type${drawType}`]: true,
          'note-draggable': noteDrag?.enabled.value,
          isDummy: note.type === 90
        }"
        :style="{
          left: `${getLeft(note)}px`,
          bottom: `${getBottom(note)}px`,
          width: `${getWidth(note)}px`
        }"
        v-bind="props"
        :ref="element => setMotionRoot(element, props.ref)"
        @pointerdown="noteDrag?.start($event, note)"
        @click="rememberMenuTarget"
        @keydown="rememberMenuTarget"
      >
        <input
          type="checkbox"
          v-model="note.isSelected"
          :id="String(note.index)"
          @click.stop
        />
        <strong v-if="Number(note.option?.[0]) && Number(note.option?.[0]) !== 1" class="speed">x{{ note.option[0] }}</strong>
        <strong v-if="Number(note.option?.[1]) && Number(note.option?.[1]) !== 0" class="orbit">&gt;{{ note.option[1] }}</strong>
        {{ note.position }}/{{ note.split }}
      </span>

      <!-- 終点ノーツ（再帰全ノード） -->
      <template v-for="ep in treeData.endpoints" :key="ep.id">
        <!-- 中継点かつ type: 1 の場合は小さな〇（コンボ加算中点） -->
        <span
          v-if="ep.isIntermediate && ep.note.type === 1"
          :ref="el => setMotionNode(ep.id, el)"
          class="note-midpoint"
          :class="{ 'note-draggable': noteDrag?.enabled.value }"
          :style="{
            left: `${getMidpointLeft(ep.note)}px`,
            bottom: `${getBottom(ep.note) - 5}px`
          }"
          @pointerdown="noteDrag?.start($event, note, ep.note)"
          @click.stop="openMenu"
        >
          <span class="midpoint-badges">
            <strong v-if="Number(ep.note.option?.[0]) && Number(ep.note.option?.[0]) !== 1" class="speed">x{{ ep.note.option[0] }}</strong>
            <strong v-if="Number(ep.note.option?.[1]) && Number(ep.note.option?.[1]) !== 0" class="orbit">&gt;{{ ep.note.option[1] }}</strong>
          </span>
        </span>
        <!-- 末端終点（type !== 89）の場合は通常のノートバー -->
        <span
          v-else-if="!ep.isIntermediate && ep.note.type !== 89"
          :ref="el => setMotionNode(ep.id, el)"
          class="note"
          :class="[
            `type${ep.note.type}`,
            { 'note-draggable': noteDrag?.enabled.value }
          ]"
          :style="{
            left: `${getLeft(ep.note)}px`,
            bottom: `${getBottom(ep.note)}px`,
            width: `${getWidth(ep.note)}px`
          }"
          @pointerdown="noteDrag?.start($event, note, ep.note)"
          @click.stop="openMenu"
        >
          <strong v-if="Number(ep.note.option?.[0]) && Number(ep.note.option?.[0]) !== 1" class="speed">x{{ ep.note.option[0] }}</strong>
          <strong v-if="Number(ep.note.option?.[1]) && Number(ep.note.option?.[1]) !== 0" class="orbit">&gt;{{ ep.note.option[1] }}</strong>
          {{ ep.note.position }}/{{ ep.note.split }}
        </span>
        <!-- 不可視ノード（type: 89）だが speed または orbit が指定されている場合はバッジのみ表示 -->
        <span
          v-else-if="hasSpeedOrOrbit(ep.note)"
          :ref="el => setMotionNode(ep.id, el)"
          class="note-invisible-badge"
          :class="{ 'note-draggable': noteDrag?.enabled.value }"
          :style="{
            left: `${getLeft(ep.note)}px`,
            bottom: `${getBottom(ep.note)}px`,
            width: `${getWidth(ep.note)}px`
          }"
          @pointerdown="noteDrag?.start($event, note, ep.note)"
          @click.stop="openMenu"
        >
          <strong v-if="Number(ep.note.option?.[0]) && Number(ep.note.option?.[0]) !== 1" class="speed">x{{ ep.note.option[0] }}</strong>
          <strong v-if="Number(ep.note.option?.[1]) && Number(ep.note.option?.[1]) !== 0" class="orbit">&gt;{{ ep.note.option[1] }}</strong>
        </span>
        <span
          v-if="ep.note.type === 89 && noteDrag?.enabled.value"
          class="note-invisible-handle note-draggable"
          :class="{ 'touch-visible': menu }"
          :style="{
            left: `${getMidpointLeft(ep.note) - 7}px`,
            bottom: `${getBottom(ep.note) - 12}px`
          }"
          aria-label="不可視の中点・終点"
          @pointerdown="noteDrag?.start($event, note, ep.note)"
          @click.stop="openMenu"
        >
          <span />
        </span>
      </template>

      <!-- 帯（SVGパス） -->
      <svg
        class="long-note-svg"
        :class="{ 'note-draggable': noteDrag?.enabled.value }"
        :style="{
          height: `${entireHeight}px`
        }"
        @pointerdown="noteDrag?.startWhole($event, note)"
      >
        <g
          v-for="seg in treeData.segments"
          :key="seg.id"
          :ref="el => setMotionSegment(seg.id, el)"
          @click.stop="openMenu"
        >
          <path :d="seg.paths.fillPath" class="hold-fill" />
          <path :d="seg.paths.leftBorderPath" class="hold-border" />
          <path :d="seg.paths.rightBorderPath" class="hold-border" />
        </g>
      </svg>
    </template>

    <!-- ポップアップ編集 -->
    <v-card v-if="menu" rounded="lg" class="pa-2">
      <v-list density="compact">
        <v-list-item class="px-2">
          <v-card-title class="pa-0 text-subtitle-1">
            #{{ note.index }} ロング {{ note.type === 90 ? "(ダミー)" : "" }}
          </v-card-title>
          <template #append>
            <v-btn icon="mdi-close" variant="text" size="small" @click="menu = false" />
          </template>
        </v-list-item>

        <div class="px-2" @keydown="stopNumberInputArrowKeys">
          <v-divider class="my-2" />
          <div class="d-flex align-center justify-space-between mb-1">
            <span class="text-subtitle-2 font-weight-bold">始点</span>
            <v-btn
              color="primary"
              variant="text"
              density="compact"
              prepend-icon="mdi-plus-circle-outline"
              @click="addEndToRoot"
            >
              ここに終点を追加
            </v-btn>
          </div>

          <v-row class="mb-2" align="center" dense>
            <v-col cols="6" sm="4">
              <v-text-field
                v-model.number="note.lane"
                v-history-field="field('ロング始点のレーンを変更')"
                label="lane"
                variant="outlined"
                density="compact"
                hide-details
                type="number"
                step="0.1"
                min="0"
                max="6"
              ></v-text-field>
            </v-col>
            <v-col cols="6" sm="4">
              <v-text-field
                :model-value="localMeasure"
                v-history-field="field('小節番号を変更', applyMeasure, isMeasureDirty)"
                @update:model-value="val => localMeasure = Number(val)"
                @change="commitRootMeasure"
                @keydown.enter.stop="commitRootMeasure"
                label="measure"
                variant="outlined"
                density="compact"
                hide-details
                type="number"
                min="0"
                :max="maxMeasure"
              ></v-text-field>
            </v-col>
            <v-col cols="6" sm="4">
              <v-text-field
                v-model.number="note.position"
                v-history-field="field('ロング始点の位置を変更')"
                label="position"
                variant="outlined"
                density="compact"
                hide-details
                type="number"
                min="0"
                :max="note.split - 1"
              ></v-text-field>
            </v-col>
            <v-col cols="6" sm="4">
              <v-combobox
                :model-value="note.split"
                v-history-field="field('ロング始点の分割数を変更')"
                @update:model-value="changeRootSplit"
                :items="[4, 8, 16, 32, 12, 24, 48]"
                label="split"
                variant="outlined"
                hide-details
                density="compact"
                :menu-props="{}"
              ></v-combobox>
            </v-col>
            <v-col cols="6" sm="4">
              <v-text-field
                v-model="rootSpeed"
                v-history-field="field('ロング始点の速度を変更')"
                label="speed"
                placeholder="1"
                variant="outlined"
                density="compact"
                hide-details
                type="number"
                step="0.1"
              ></v-text-field>
            </v-col>
            <v-col cols="6" sm="4">
              <v-text-field
                v-model="rootOrbit"
                v-history-field="field('ロング始点の軌道を変更')"
                label="orbit"
                placeholder="0"
                variant="outlined"
                density="compact"
                hide-details
                type="number"
                step="0.1"
              ></v-text-field>
            </v-col>
          </v-row>
        </div>

        <v-divider class="my-2" />

        <div class="px-2" @keydown="stopNumberInputArrowKeys">
          <EndForm
            v-for="(en, i) in note.end"
            :key="`append_end_root_${i}`"
            :end="en"
            :parent="note"
            :index="i"
            :max-measure="maxMeasure"
            history-enabled
            @delete-end="deleteEnd(i)"
            @shift-lane="shiftLongLane"
            @shift-position="shiftLongPosition"
            @place-notes="menu = false"
          />
        </div>
      </v-list>

      <v-card-actions class="pt-0 px-2 justify-space-between">
        <v-btn color="error" variant="text" prepend-icon="mdi-delete" @click="deleteThisNote">
          ノートを削除
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { computed, inject, ref, type ComponentPublicInstance } from 'vue'
import { stopNumberInputArrowKeys } from '@/composables/useNumberInputKeys'
import type { NoteData } from 'chart-types'
import { type ExtendedNoteData, type Measure } from '@/types'
import { deleteNotesKey } from '@/composables/injectionKeys'
import { generateHoldSvgPaths, getCurveType, type CurveType } from '@/composables/useNoteTypes'
import EndForm from './EndForm.vue'
import { useNoteMeasureEdit } from '@/composables/useNoteMeasureEdit'
import { useNoteMenuLocation } from '@/composables/useNoteMenuLocation'
import { shiftLongNoteLane, shiftLongNotePosition } from '@/composables/noteMovement'
import { noteDragKey } from '@/composables/useNoteDrag'
import { numberInputValue, useHistoryFields, vHistoryField } from '@/composables/useHistoryField'
import {
  getNoteMotion,
  usePreviewMotionSource,
  type MotionPoint,
  type MotionSource,
} from '@/composables/usePreviewNoteMotion'

const props = defineProps<{
  note: ExtendedNoteData
  measureData: Measure[]
  currentDifficulty?: string
}>()

const deleteNotes = inject(deleteNotesKey)!
const noteDrag = inject(noteDragKey, null)

/** ロング始点の位置補正を適用する要素。 */
const motionRoot = ref<HTMLElement | null>(null)

/** ツリー内の経路IDと、現在表示している中点・終点の要素との対応。 */
const motionNodes = new Map<string, HTMLElement>()

/** ツリー内の区間IDと、その帯を構成するSVGグループとの対応。 */
const motionSegments = new Map<string, SVGGElement>()

/**
 * ロング始点を描画補正へ渡し、同じ要素をVuetifyのactivatorにも保持させる。
 * v-bindによるrefの上書きを避け、メニューの配置やフォーカスにも必要な参照を残す。
 *
 * @param element マウント時の始点要素。アンマウント時にはnullを受け取る。
 * @param activatorRef Vuetifyが渡す参照の更新関数。
 */
function setMotionRoot(
  element: Element | ComponentPublicInstance | null,
  activatorRef?: (element: Element | ComponentPublicInstance | null) => void,
) {
  motionRoot.value = element instanceof HTMLElement ? element : null

  activatorRef?.(element)
}

/** 中点・終点の表示切り替えや破棄に合わせて、要素の参照を更新する。 */
function setMotionNode(id: string, element: Element | ComponentPublicInstance | null) {
  if (element instanceof HTMLElement) {
    motionNodes.set(id, element)
  } else {
    motionNodes.delete(id)
  }
}

/** 帯の生成・破棄に合わせて、パスを更新するSVGグループの参照を更新する。 */
function setMotionSegment(id: string, element: Element | ComponentPublicInstance | null) {
  if (element instanceof SVGElement) {
    motionSegments.set(id, element as SVGGElement)
  } else {
    motionSegments.delete(id)
  }
}

/**
 * ロングの全端点と帯の接続関係を、その時点の座標とともに収集する。
 * 不可視端点に対応する要素がなくても、帯を結ぶ座標は取得しておく。
 */
function collectMotionSource(): MotionSource {
  /** 複数の帯から共有する端点について、同じ座標情報の生成を繰り返さないための対応表。 */
  const points = new Map<NoteData, MotionPoint>()

  /** 端点ごとの速度を独立して読み、帯の中心位置と幅を含む描画情報を取得する。 */
  function point(note: NoteData): MotionPoint {
    let result = points.get(note)

    if (!result) {
      result = {
        ...(getNoteMotion(note, note !== props.note) ?? { speed: 1, orbit: 0 }),
        bottom: getBottom(note),
        left: getMidpointLeft(note) + 5,
        width: getHoldNodeWidth(note) * 38,
      }

      points.set(note, result)
    }

    return result
  }

  const nodes: NonNullable<MotionSource['nodes']> = []

  if (motionRoot.value) {
    nodes.push({ element: motionRoot.value, point: point(props.note) })
  }

  for (const endpoint of treeData.value.endpoints) {
    const element = motionNodes.get(endpoint.id)

    if (element) {
      nodes.push({ element, point: point(endpoint.note) })
    }
  }

  // 帯は親と子の補正後の座標を結ぶ。曲線の種類と幅は編集時の指定を引き継ぐ。
  const segments: NonNullable<MotionSource['segments']> = []

  for (const segment of treeData.value.segments) {
    const element = motionSegments.get(segment.id)

    if (element) {
      segments.push({
        element,
        start: point(segment.parent),
        end: point(segment.child),
        curve: segment.curveType,
        height: entireHeight.value,
      })
    }
  }

  return { nodes, segments }
}

// 通常の編集表示では参照の登録だけを行い、収集処理は個別描画の有効化まで実行しない。
usePreviewMotionSource(collectMotionSource)

const { history, field, change, input } = useHistoryFields()
const {
  menu,
  localMeasure,
  applyMeasure,
  commitMeasure: commitRootMeasure,
  isMeasureDirty,
} = useNoteMeasureEdit(() => props.note, history)

const {
  menuTarget,
  locationStrategy,
  rememberMenuTarget,
  openMenu,
} = useNoteMenuLocation(menu, 420)

/** 分割数の入力や候補選択を、始点の同じ入力欄の編集として履歴へまとめる。 */
function changeRootSplit(value: unknown) {
  input('ロング始点の分割数を変更', () => {
    props.note.split = numberInputValue(value)
  })
}

const rootSpeed = computed<string>({
  get: () => props.note.option?.[0] ?? '',
  set: (val) => {
    if (!props.note.option) props.note.option = []
    while (props.note.option.length < 1) props.note.option.push('')
    props.note.option[0] = val ?? ''
  },
})

const rootOrbit = computed<string>({
  get: () => props.note.option?.[1] ?? '',
  set: (val) => {
    if (!props.note.option) props.note.option = []
    while (props.note.option.length < 2) props.note.option.push('')
    props.note.option[1] = val ?? ''
  },
})

function getHoldNodeWidth(n: NoteData | ExtendedNoteData): number {
  if (n.type === 2) return 1
  const w = Number(n.option?.[3])
  if (!w || isNaN(w) || w <= 0 || w === -1) return 1
  return w
}

function hasSpeedOrOrbit(note: NoteData): boolean {
  const s = Number(note.option?.[0])
  const o = Number(note.option?.[1])
  return Boolean((s && s !== 1) || (o && o !== 0))
}

const entireHeight = computed(() => {
  const last = props.measureData.at(-1)
  return (last?.measurePositionBottom ?? 0) + (last?.measureHeight ?? 0)
})

const maxMeasure = computed(() => (props.measureData.length > 0 ? props.measureData.length - 1 : 999))

function getLeft(n: NoteData | ExtendedNoteData) {
  const w = getHoldNodeWidth(n)
  const center = (n.lane - 1) * 60 + 60 + 30
  return center - (w / 2) * 60
}

function getMidpointLeft(n: NoteData | ExtendedNoteData) {
  return (n.lane - 1) * 60 + 60 + 30 - 5
}

function getBottom(n: NoteData | ExtendedNoteData) {
  const m = props.measureData[n.measure]
  if (!m) return 0
  return (
    m.measurePositionBottom +
    (n.position / n.split) * m.measureHeight
  )
}

function getWidth(n: NoteData | ExtendedNoteData) {
  return 60 * getHoldNodeWidth(n)
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

  /**
   * 子ノーツを再帰的にたどり、端点と帯の描画情報を集める。
   *
   * @param parent 接続元のノーツ
   * @param depth 始点からの階層の深さ
   * @param parentId 位置変更によって変化しない、親までの経路を表す識別子
   */
  function traverse(parent: NoteData, depth: number, parentId = 'root') {
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
      const b1 = getBottom(parent)
      const x2 = (child.lane - 1) * 60 + 60 + 30
      const b2 = getBottom(child)

      const y1 = entireHeight.value - b1
      const y2 = entireHeight.value - b2
      const curveType = getCurveType(child)

      const w1 = getHoldNodeWidth(parent) * 38
      const w2 = getHoldNodeWidth(child) * 38

      const paths = generateHoldSvgPaths(x1, y1, x2, y2, curveType, w1, w2)
      segments.push({
        id: `seg_${childId}`,
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

/** ロング始点に終点を追加し、1操作として記録する。 */
function addEndToRoot(): void {
  change('ロングに終点を追加', () => props.note.end.push({
    type: 1,
    lane: props.note.lane,
    measure: props.note.measure,
    position: Math.min(props.note.position + 1, props.note.split),
    split: props.note.split,
    option: ['', '', 'linear'],
    end: [],
  }))
}

/** 指定した終点とその子孫を削除し、1操作として記録する。 */
function deleteEnd(index: number): void {
  change('ロングの終点を削除', () => props.note.end.splice(index, 1))
}

/** 終点フォームの Shift+左右キーから、配置済みロングノーツ全体のレーンを 0〜6 の範囲で平行移動する。 */
function shiftLongLane(delta: number): void {
  shiftLongNoteLane(props.note, delta)
}

/**
 * 終点フォームの Shift+上下キーから、配置済みロングノーツ全体の位置を平行移動する。
 * 始点の小節が変わった場合は、メニュー閉鎖時に古い値へ戻らないよう小節入力欄も同期する。
 */
function shiftLongPosition(step: number, split: number): void {
  const moved = shiftLongNotePosition(props.note, step, split)

  if (moved) {
    localMeasure.value = props.note.measure
  }
}

function deleteThisNote(): void {
  deleteNotes(props.note.index)
  menu.value = false
}

const drawType = computed(() => {
  if (props.note.type === 90) return Number(props.note.option[0])
  return props.note.type
})
</script>

<style lang="scss" scoped>
.note-invisible-handle {
  position: absolute;
  z-index: 105;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;

  > span {
    width: 10px;
    height: 10px;
    border: 2px solid #6ecc6e;
    background: #303030;
    transform: rotate(45deg);
    opacity: 0;
  }

  @media (hover: hover) {
    &:hover > span {
      opacity: 1;
    }
  }

  @media (hover: none) {
    &.touch-visible > span {
      opacity: 1;
    }

    &:not(.touch-visible) {
      pointer-events: none;
    }
  }
}

.long-note-svg {
  &.note-draggable {
    .hold-fill,
    .hold-border {
      cursor: grab;
    }
  }

  .hold-fill {
    pointer-events: visibleFill;
    cursor: pointer;
  }

  .hold-border {
    pointer-events: visibleStroke;
    cursor: pointer;
  }
}

.v-card {
  max-height: 80vh;
  overflow-y: auto;
}
</style>
