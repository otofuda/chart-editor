<!-- eslint-disable vue/no-mutating-props -->
<template>
  <v-menu
    v-model="menu"
    :close-on-click="false"
    :close-on-content-click="false"
    location="left"
    :max-width="420"
  >
    <template v-slot:activator="{ props }">
      <!-- 始点 -->
      <span
        class="note"
        :class="{
          [`type${drawType}`]: true,
          isDummy: note.type === 90
        }"
        :style="{
          left: `${getLeft(note)}px`,
          bottom: `${getBottom(note)}px`,
          width: `${getWidth(note)}px`
        }"
        :title="getNoteTooltip(note)"
        v-bind="props"
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
          class="note-midpoint"
          :style="{
            left: `${getMidpointLeft(ep.note)}px`,
            bottom: `${getBottom(ep.note) - 5}px`
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
          :class="`type${ep.note.type}`"
          :style="{
            left: `${getLeft(ep.note)}px`,
            bottom: `${getBottom(ep.note)}px`,
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
          :style="{
            left: `${getLeft(ep.note)}px`,
            bottom: `${getBottom(ep.note)}px`,
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
        class="long-note-svg"
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

        <div class="px-2">
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
                v-model.number="note.split"
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

        <div class="px-2">
          <EndForm
            v-for="(en, i) in note.end"
            :key="`append_end_root_${i}`"
            :end="en"
            :parent="note"
            :index="i"
            :max-measure="maxMeasure"
            @delete-end="deleteEnd(i)"
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
import { ref, computed, inject, watch } from 'vue'
import type { NoteData } from 'chart-types'
import { type ExtendedNoteData, type Measure } from '@/types'
import { deleteNotesKey } from '@/composables/injectionKeys'
import { generateHoldSvgPaths, getCurveType, type CurveType } from '@/composables/useNoteTypes'
import EndForm from './EndForm.vue'

const props = defineProps<{
  note: ExtendedNoteData
  measureData: Measure[]
  currentDifficulty?: string
}>()

const deleteNotes = inject(deleteNotesKey)!

const menu = ref(false)
const localMeasure = ref(props.note.measure)

function commitRootMeasure() {
  props.note.measure = localMeasure.value
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

function getNoteTooltip(note: NoteData): string {
  let text = `${note.position}/${note.split}`
  if (note.option?.[0] && Number(note.option[0]) !== 1) text += ` (speed: x${note.option[0]})`
  if (note.option?.[1] && Number(note.option[1]) !== 0) text += ` (orbit: >${note.option[1]})`
  if (note.option?.[3] && Number(note.option[3]) !== 1 && Number(note.option[3]) > 0) text += ` (width: ${note.option[3]})`
  return text
}

watch(menu, (isOpen) => {
  if (isOpen) {
    localMeasure.value = props.note.measure
  } else {
    props.note.measure = localMeasure.value
  }
})

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

  function traverse(parent: NoteData, depth: number) {
    if (!parent.end || !Array.isArray(parent.end)) return

    parent.end.forEach((child, idx) => {
      const childId = `end_${depth}_${idx}_${child.measure}_${child.position}`
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

      traverse(child, depth + 1)
    })
  }

  traverse(props.note, 1)
  return { segments, endpoints }
})

function addEndToRoot(): void {
  props.note.end.push({
    type: 1,
    lane: props.note.lane,
    measure: props.note.measure,
    position: Math.min(props.note.position + 1, props.note.split),
    split: props.note.split,
    option: ['', '', 'linear'],
    end: [],
  })
}

function deleteEnd(index: number): void {
  props.note.end.splice(index, 1)
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
.v-card {
  max-height: 80vh;
  overflow-y: auto;
}
</style>
