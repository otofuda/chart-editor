<!-- eslint-disable vue/no-mutating-props -->
<template>
  <div class="mt-2">
    <v-row>
      <p class="ma-0">終点 #{{ index }}</p>
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
    <v-row class="mb-2">
      <v-col cols="12" sm="3">
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
      <!-- <v-col cols="12" sm="3">
        <v-select
          :items="[1, 2, 3, 4, 5]"
          hide-details
          label="lane"
          v-model="end.lane"
          variant="outlined"
          density="compact"
          :menu-props="{}"
        ></v-select>
      </v-col> -->
      <v-col cols="12" sm="3">
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
      <v-col cols="12" sm="3">
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
      <v-col cols="12" sm="3">
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
    </v-row>

    <!-- エラー表示 -->
    <v-alert
      dense
      type="error"
      v-for="error in errors"
      :key="`append_end_${index}_error${error}`"
      rounded="lg"
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
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LaneType, NoteData } from 'chart-types'

const props = withDefaults(
  defineProps<{
    end: NoteData
    parent: NoteData
    index: number
    maxMeasure?: number
  }>(),
  {
    maxMeasure: 999,
  }
)

const emit = defineEmits(['delete-end', 'append-to-left', 'append-to-right', 'append-to-up', 'append-to-down', 'place-notes'])

function addEndToThis(): void {
  props.end.end.push({
    type: 1,
    lane: props.end.lane,
    measure: props.end.measure,
    position: Math.min(props.end.position + 1, props.end.split),
    split: props.end.split,
    option: [],
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

// positionにフォーカスして終点移動
function endToLeft(): void {
  props.end.lane = Math.max(props.end.lane - 1, 1) as LaneType
  emit('append-to-left', props.index)
}

function endToRight(): void {
  props.end.lane = Math.min(props.end.lane + 1, 5) as LaneType
  emit('append-to-right', props.index)
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
  if (props.end.lane !== props.parent.lane) {
    arr.push('終点と親ノートのレーン位置が異なります。')
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
  padding-left: 24px;
}
</style>
