<!-- eslint-disable vue/no-mutating-props -->
<template>
  <div class="mt-2">
    <v-row align="center">
      <p class="ma-0 font-weight-medium">終点 #{{ index }}</p>
      <v-spacer />
      <div>
        <v-btn
          color="primary"
          variant="text"
          density="compact"
          prepend-icon="mdi-plus-circle-outline"
          @click="addEndToThis"
        >
          ここに終点を追加
        </v-btn>
        <v-btn
          color="error"
          variant="text"
          density="compact"
          prepend-icon="mdi-delete"
          @click="deleteThisEnd"
        >
          この終点を削除
        </v-btn>
      </div>
    </v-row>
    <v-row class="mb-2" align="center" dense>
      <v-col cols="6" sm="4">
        <v-text-field
          v-model.number="end.lane"
          label="lane"
          variant="outlined"
          density="compact"
          hide-details
          type="number"
          step="0.1"
        ></v-text-field>
      </v-col>
      <v-col cols="6" sm="4">
        <v-select
          :items="[
            { title: '通常', value: 1 },
            { title: '終端なし', value: 89 }
          ]"
          hide-details
          label="type"
          v-model="end.type"
          variant="outlined"
          density="compact"
          :menu-props="{}"
        ></v-select>
      </v-col>
      <v-col cols="6" sm="4">
        <v-select
          :items="curveTypeOptions"
          hide-details
          label="曲線"
          v-model="curveType"
          variant="outlined"
          density="compact"
          :menu-props="{}"
        ></v-select>
      </v-col>
      <v-col cols="6" sm="4">
        <v-text-field
          v-model.number="end.measure"
          label="measure"
          variant="outlined"
          density="compact"
          hide-details
          type="number"
          min="0"
        ></v-text-field>
      </v-col>
      <v-col cols="6" sm="4">
        <v-text-field
          v-model.number="end.position"
          label="position"
          variant="outlined"
          density="compact"
          hide-details
          min="0"
          :max="end.split - 1"
          bg-color="#ffffc0"
          @keydown.enter="placeNotes"
          @keydown.left="endToLeft"
          @keydown.right="endToRight"
          @keydown.up="endToUp"
          @keydown.down="endToDown"
        ></v-text-field>
      </v-col>
      <v-col cols="6" sm="4">
        <v-combobox
          v-model.number="end.split"
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
          v-model="endSpeed"
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
          v-model="endOrbit"
          label="orbit"
          placeholder="0"
          variant="outlined"
          density="compact"
          hide-details
          type="number"
          step="0.1"
        ></v-text-field>
      </v-col>
      <v-col cols="12" sm="4">
        <v-text-field
          v-model="endWidth"
          label="width"
          placeholder="1 (通常幅)"
          variant="outlined"
          density="compact"
          hide-details
          type="number"
          step="0.1"
        ></v-text-field>
      </v-col>
    </v-row>

    <!-- エラー表示 -->
    <v-alert
      dense
      type="error"
      v-for="error in errors"
      :key="`append_end_${index}_error${error}`"
      rounded="lg"
      class="mb-2"
    >
      {{ error }}
    </v-alert>

    <!-- 再帰的な終点フォーム -->
    <div class="recursive-end">
      <EndForm
        v-for="(en, i) in end.end"
        :key="`append_end_${index}_${i}`"
        :end="en"
        :parent="end"
        :index="i"
        :max-measure="props.maxMeasure"
        @delete-end="deleteChild"
        @place-notes="placeNotes"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { type PropType } from 'vue'
import { type LaneType, type NoteData } from 'chart-types'
import { curveTypeOptions, getCurveType, type CurveType } from '@/composables/useNoteTypes'

const props = defineProps({
  end: {
    type: Object as PropType<NoteData>,
    required: true,
  },
  parent: {
    type: Object as PropType<NoteData>,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
  maxMeasure: {
    type: Number,
    required: false,
    default: 999,
  },
})

const emit = defineEmits(['delete-end', 'append-to-up', 'append-to-down', 'place-notes'])

const endSpeed = computed<string>({
  get: () => props.end.option?.[0] ?? '',
  set: (val) => {
    if (!props.end.option) props.end.option = []
    while (props.end.option.length < 1) props.end.option.push('')
    props.end.option[0] = val ?? ''
  },
})

const endOrbit = computed<string>({
  get: () => props.end.option?.[1] ?? '',
  set: (val) => {
    if (!props.end.option) props.end.option = []
    while (props.end.option.length < 2) props.end.option.push('')
    props.end.option[1] = val ?? ''
  },
})

const curveType = computed<CurveType>({
  get: () => getCurveType(props.end),
  set: (val) => {
    if (!props.end.option) props.end.option = []
    while (props.end.option.length < 3) props.end.option.push('')
    props.end.option[2] = val
  },
})

const endWidth = computed<string>({
  get: () => props.end.option?.[3] ?? '',
  set: (val) => {
    if (!props.end.option) props.end.option = []
    while (props.end.option.length < 4) props.end.option.push('')
    props.end.option[3] = val ?? ''
  },
})

function addEndToThis(): void {
  props.end.end.push({
    type: 1,
    lane: props.end.lane,
    measure: props.end.measure,
    position: Math.min(props.end.position + 1, props.end.split),
    split: props.end.split,
    option: ['', '', 'linear'],
    end: [],
  })
}

function deleteThisEnd(): void {
  emit('delete-end', props.index)
}

// 再帰の場合、自分の終点リストから子を消去
function deleteChild(index: number): void {
  props.end.end.splice(index, 1)
}

// positionにフォーカスして終点移動（その終点のみ 1.0 刻みで変更）
function endToLeft(): void {
  props.end.lane = (Math.round((Number(props.end.lane ?? 1) - 1) * 10) / 10) as LaneType
}

function endToRight(): void {
  props.end.lane = (Math.round((Number(props.end.lane ?? 1) + 1) * 10) / 10) as LaneType
}

function endToUp(event: KeyboardEvent): void {
  const note = props.end
  if (note.split - 1 <= note.position) {
    note.measure++
    note.position = 0
  } else note.position++
  // Shift同時押しで親も移動
  if (event.shiftKey) emit('append-to-up', props.index)
}

function endToDown(event: KeyboardEvent): void {
  const note = props.end
  if (note.position === 0) {
    note.measure--
    note.position = note.split - 1
  } else note.position--
  // Shift同時押しで親も移動
  if (event.shiftKey) emit('append-to-down', props.index)
}

// App.vueの配置メソッドを発火
function placeNotes(): void {
  emit('place-notes')
}

// 親ノートの小節ベース座標
const parentPosition = computed(() => props.parent.measure + props.parent.position / props.parent.split)
// 自分自身の小節ベース座標
const selfPosition = computed(() => props.end.measure + props.end.position / props.end.split)

const errors = computed(() => {
  const arr: string[] = []
  if (selfPosition.value <= parentPosition.value) {
    arr.push('終点が親ノートよりも手前または同じ位置にあります。')
  }
  if (props.end.measure > props.maxMeasure) {
    arr.push(`存在しない小節に終点を配置できません(現在、譜面は${props.maxMeasure}小節まで)`)
  }
  return arr
})
</script>

<style lang="scss" scoped>
.recursive-end {
  border-left: 2px solid #909090;
  padding-left: 16px;
  margin-top: 8px;
}
</style>
