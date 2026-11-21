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
          v-history-field="field('終点のレーンを変更')"
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
          :model-value="end.type"
          @update:model-value="value => change('終点の種別を変更', () => end.type = value)"
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
          :model-value="curveType"
          @update:model-value="value => change('終点の曲線を変更', () => curveType = value)"
          variant="outlined"
          density="compact"
          :menu-props="{}"
        ></v-select>
      </v-col>
      <v-col cols="6" sm="4">
        <v-text-field
          v-model.number="end.measure"
          v-history-field="field('終点の小節番号を変更')"
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
          v-history-field="field('終点の位置を変更')"
          label="position"
          variant="outlined"
          density="compact"
          hide-details
          min="0"
          :max="end.split - 1"
          bg-color="editor-highlight"
          @keydown.enter="handlePositionEnter($event, placeNotes)"
          @keydown.left="endToLeft"
          @keydown.right="endToRight"
          @keydown.up.stop="endToUp"
          @keydown.down.stop="endToDown"
        ></v-text-field>
      </v-col>
      <v-col cols="6" sm="4">
        <v-combobox
          :model-value="end.split"
          v-history-field="field('終点の分割数を変更')"
          @update:model-value="changeSplit"
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
          v-history-field="field('終点の速度を変更')"
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
          v-history-field="field('終点の軌道を変更')"
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
          v-history-field="field('終点の幅を変更')"
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
        :history-enabled="historyEnabled"
        @delete-end="deleteChild"
        @shift-lane="delta => emit('shift-lane', delta)"
        @shift-position="(step, split) => emit('shift-position', step, split)"
        @place-notes="placeNotes"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LaneType, NoteData } from 'chart-types'
import { curveTypeOptions, getCurveType, type CurveType } from '@/composables/useNoteTypes'
import { numberInputValue, useHistoryFields, vHistoryField } from '@/composables/useHistoryField'
import { handlePositionEnter, isIgnoredKeyboardEvent } from '@/composables/useEditorShortcuts'

const props = withDefaults(
  defineProps<{
    end: NoteData
    parent: NoteData
    index: number
    maxMeasure?: number
    historyEnabled?: boolean
  }>(),
  {
    maxMeasure: 999,
  }
)

const emit = defineEmits<{
  'delete-end': [index: number]
  'shift-lane': [delta: number]
  'shift-position': [step: number, split: number]
  'place-notes': []
}>()
const { field, change, input } = useHistoryFields(() => Boolean(props.historyEnabled))

/** 分割数の入力や候補選択を、終点の同じ入力欄の編集として履歴へまとめる。 */
function changeSplit(value: unknown) {
  input('終点の分割数を変更', () => {
    props.end.split = numberInputValue(value)
  })
}

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

/** この終点へ子の終点を追加する。確定済みノーツの場合だけ履歴に記録する。 */
function addEndToThis(): void {
  change('終点に子の終点を追加', () => props.end.end.push({
    type: 1,
    lane: props.end.lane,
    measure: props.end.measure,
    position: Math.min(props.end.position + 1, props.end.split),
    split: props.end.split,
    option: ['', '', 'linear'],
    end: [],
  }))
}

/** 親へ削除を依頼し、子孫を含む終点の削除を1操作として記録する。 */
function deleteThisEnd(): void {
  change('終点を削除', () => emit('delete-end', props.index))
}

/** 再帰したフォームから削除を依頼された子の終点を取り除く。 */
function deleteChild(index: number): void {
  change('子の終点を削除', () => props.end.end.splice(index, 1))
}

/** IME変換中や他修飾キー併用時は入力欄の標準操作を優先するため処理しない。 */
function isIgnoredArrowEvent(event: KeyboardEvent): boolean {
  return (
    isIgnoredKeyboardEvent(event)
    || event.ctrlKey
    || event.metaKey
    || event.altKey
  )
}

/**
 * 終点 position 欄での左キー操作を処理する。
 * Shift 同時押し時はロング全体の横移動を親へ委譲し、単独押し時はこの終点のみ 0.0〜6.0 の範囲で左へ移動する。
 */
function endToLeft(event: KeyboardEvent): void {
  if (isIgnoredArrowEvent(event)) {
    return
  }

  if (event.shiftKey) {
    event.preventDefault()
    emit('shift-lane', -1)

    return
  }

  const next = Math.round((Number(props.end.lane ?? 1) - 1) * 10) / 10
  props.end.lane = Math.min(6, Math.max(0, next)) as LaneType
}

/**
 * 終点 position 欄での右キー操作を処理する。
 * Shift 同時押し時はロング全体の横移動を親へ委譲し、単独押し時はこの終点のみ 0.0〜6.0 の範囲で右へ移動する。
 */
function endToRight(event: KeyboardEvent): void {
  if (isIgnoredArrowEvent(event)) {
    return
  }

  if (event.shiftKey) {
    event.preventDefault()
    emit('shift-lane', 1)

    return
  }

  const next = Math.round((Number(props.end.lane ?? 1) + 1) * 10) / 10
  props.end.lane = Math.min(6, Math.max(0, next)) as LaneType
}

/**
 * 終点 position 欄での上キー操作を処理する。
 * Shift 同時押し時はこの終点の分割数基準でロング全体の縦移動を親へ委譲し、単独押し時はこの終点のみ進める。
 */
function endToUp(event: KeyboardEvent): void {
  if (isIgnoredArrowEvent(event)) {
    return
  }

  if (event.shiftKey) {
    event.preventDefault()
    emit('shift-position', 1, props.end.split)

    return
  }

  const note = props.end

  if (note.split - 1 <= note.position) {
    note.measure++
    note.position = 0
  } else {
    note.position++
  }
}

/**
 * 終点 position 欄での下キー操作を処理する。
 * Shift 同時押し時はこの終点の分割数基準でロング全体の縦移動を親へ委譲し、単独押し時はこの終点のみ戻す。
 */
function endToDown(event: KeyboardEvent): void {
  if (isIgnoredArrowEvent(event)) {
    return
  }

  if (event.shiftKey) {
    event.preventDefault()
    emit('shift-position', -1, props.end.split)

    return
  }

  const note = props.end

  if (note.position === 0) {
    note.measure--
    note.position = note.split - 1
  } else {
    note.position--
  }
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
