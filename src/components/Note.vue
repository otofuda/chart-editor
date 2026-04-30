<!-- eslint-disable vue/no-mutating-props -->
<template>
  <v-menu
    v-model="menu"
    :close-on-click="false"
    :close-on-content-click="false"
    stick-to-target
    :nudge-left="50"
    :max-width="240"
  >
    <template v-slot:activator="{ props }">
      <!-- 音符を描画 -->
      <span
        class="note"
        :class="{
          [`type${drawType}`]: true,
          isDummy: note.type === 90,
          hidden: isHiddenControl,
          menu
        }"
        :style="{
          left: `${positionLeft}px`,
          bottom: `${positionBottom}px`,
          width: `${noteWidth}px`,
          background: dispColor
        }"
        v-bind="props"
      >
        <!-- テクスチャの時 -->
        <img
          v-if="drawType === 94"
          :src="
            String(drawOptions[0]).startsWith('texture')
            ? `https://db.otofuda.com/${drawOptions[0]}`
            : drawOptions[0]
          "
          :style="{
            height: `${measure.measureHeight * Number(drawOptions[2])}px`
          }"
          alt="texture"
        />

        <!-- コメントの時 -->
        <v-icon v-if="drawType === 100" color="warning" class="mt-2">
          mdi-comment
        </v-icon>
        <v-textarea
          variant="outlined"
          v-if="drawType === 100"
          v-model="note.option[0]"
          class="elevation-4"
          bg-color="#ffffc0"
          hide-details
          @click.stop
        ></v-textarea>

        <input
          type="checkbox"
          v-model="note.isSelected"
          :id="String(note.index)"
          @click.stop
        />

        <v-tooltip v-if="getDuplicated" bottom>
          <template v-slot:activator="{ props }">
            <v-icon color="warning" dark v-bind="props" class="mt-2">
              mdi-alert
            </v-icon>
          </template>
          <span>{{ getDuplicated }}個の重複</span>
        </v-tooltip>

        <v-tooltip v-if="getError" bottom>
          <template v-slot:activator="{ props }">
            <v-icon color="error" dark v-bind="props" class="mt-2">
              mdi-alert-circle-outline
            </v-icon>
          </template>
          <span>{{ getError }}</span>
        </v-tooltip>

        <strong v-if="noteSpeed !== 1" class="speed">x{{ noteSpeed }}</strong>
        <strong v-if="noteOrbit !== 0" class="orbit">&gt;{{ noteOrbit }}</strong>

        <strong v-if="drawType === 97">BEAT {{ note.option[0] }}</strong>
        {{ note.position }}/{{ note.split }}
        <strong v-if="drawType === 91">SpObj</strong>
        <strong v-if="drawType === 92">STOP</strong>
        <strong v-if="drawType === 93">WARP {{ note.option[0] }}</strong>
        <strong v-if="drawType === 98">BPM {{ note.option[0] }}</strong>
        <strong v-if="drawType === 99">EOF</strong>
      </span>
    </template>

    <!-- ポップアップ編集 -->
    <v-card v-if="menu">
      <v-list>
        <v-list-item>
          <v-card-text>#{{ note.index }} {{ noteTypeName }}</v-card-text>
          <template #append>
            <v-btn size="small" icon="mdi-close" variant="text" @click="menu = false" />
          </template>
        </v-list-item>

        <v-list-item>
          <v-text-field
            :value="note.measure"
            @change="(value) => (note.measure = Number(value))"
            @keydown.enter.stop="menu = false"
            hide-details
            suffix="小節"
            variant="outlined"
            density="compact"
          ></v-text-field>
        </v-list-item>

        <v-list-item>
          <v-row class="mb-0 pt-2">
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="note.position"
                label="position"
                variant="outlined"
                density="compact"
                hide-details
                type="number"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="note.split"
                label="split"
                variant="outlined"
                density="compact"
                hide-details
                type="number"
              ></v-text-field>
            </v-col>
          </v-row>
        </v-list-item>

        <v-list-item>
          LANE
          <v-spacer></v-spacer>
          <v-radio-group
            v-model.number="note.lane"
            inline
            hide-details
            :disabled="getIsLanelessNote"
            class="mt-0"
          >
            <v-radio v-for="n in 5" :key="n" :value="n"></v-radio>
          </v-radio-group>
        </v-list-item>

        <v-list-item>
          <v-select
            class="pt-2"
            :items="getNoteTypes"
            hide-details
            label="ノート種別"
            v-model="note.type"
            align="left"
            variant="outlined"
            density="compact"
          ></v-select>
        </v-list-item>

        <v-list-item v-if="getOptions.length > 0">
          <v-card-text>オプション</v-card-text>
          <template #append>
            <v-btn
              size="small"
              href="https://github.com/otofuda/chart-types"
              target="_blank"
              icon="mdi-help"
              variant="text"
            />
          </template>
        </v-list-item>

        <v-list-item v-for="(opt, i) in getOptions" :key="`option_${i}`">
          <v-text-field
            v-model="note.option[i]"
            hide-details
            :label="opt.label"
            :type="opt.type"
            variant="solo-filled"
            density="compact"
          ></v-text-field>
        </v-list-item>
      </v-list>

      <v-card-actions>
        <v-btn color="primary" variant="text" @click="cloneThisNote">
          <v-icon>mdi-content-copy</v-icon>
        </v-btn>
        <v-btn color="error" variant="text" @click="deleteThisNote" prepend-icon="mdi-delete">
          削除
        </v-btn>
        <v-btn color="secondary" variant="text" @click="showNoteInfo">
          <v-icon>mdi-information</v-icon>
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import { type ExtendedNoteData, type Measure } from '@/types'
import { noteTypes, noteOptions } from '@/composables/useNoteTypes'
import { isDuplicated, hasError, isLanelessNote } from '@/composables/useNoteCheck'
import { deleteNotesKey, setAppendNoteInfoKey, showSnackbarKey } from '@/composables/injectionKeys'

const props = defineProps<{
  note: ExtendedNoteData
  measure: Measure
  currentChart: ExtendedNoteData[]
}>()

const deleteNotes = inject(deleteNotesKey)!
const setAppendNoteInfo = inject(setAppendNoteInfoKey)!
const showSnackbar = inject(showSnackbarKey)!

const menu = ref(false)

function deleteThisNote() {
  deleteNotes(props.note.index)
  menu.value = false
}

function cloneThisNote() {
  setAppendNoteInfo({ ...props.note, option: [...props.note.option], end: [] })
  menu.value = false
  showSnackbar('挿入ノートに同じデータをセットしました')
}

function showNoteInfo() {
  showSnackbar(JSON.stringify(props.note, null, 2))
}

/** 描画用のノートタイプ(ダミー時は擬態対象) */
const drawType = computed(() => {
  if (props.note.type === 90) return Number(props.note.option[0])
  return props.note.type
})

/** 描画用のOption配列(ダミー時は[0]を削除したもの) */
const drawOptions = computed(() => {
  if (props.note.type === 90) return props.note.option.slice(1)
  return props.note.option
})

const positionLeft = computed(() => {
  // TAP, ロング, 区切り線, コメント
  if ([1, 2, 95, 100].includes(drawType.value)) return (props.note.lane - 1) * 60
  // 左右フリック, 上下フリック
  else if ([3, 4, 6, 7].includes(drawType.value)) {
    let _width = Number(drawOptions.value[0]) || 3
    if (_width === -1) _width = 3
    const _left = (props.note.lane - 1) * 60 + 30
    let _offset = 0
    const numer = Number(drawOptions.value[1]), denom = Number(drawOptions.value[2])
    if (numer && denom) _offset = (numer / denom) * 60
    return _left - (_width / 2) * 60 + _offset
  // テクスチャ
  } else if (drawType.value === 94) {
    let _width = Number(drawOptions.value[1]) || 1
    const _left = (props.note.lane - 1) * 60 + 30
    let _offset = 0
    if (drawOptions.value[3] && drawOptions.value[4]) _offset = (Number(drawOptions.value[3]) / Number(drawOptions.value[4])) * 60
    return _left - (_width / 2) * 60 + _offset
  // LED制御
  } else if (drawType.value === 96) return -50
  // 音札, その他特殊ノーツ
  else return 0
})

const positionBottom = computed(() => (props.note.position / props.note.split) * props.measure.measureHeight)

const noteWidth = computed(() => {
  // TAP, ロング, 終点, コメント
  if ([1, 2, 89, 100].includes(drawType.value)) return 60
  // 左右フリック, 上下フリック
  else if ([3, 4, 6, 7].includes(drawType.value)) {
    let _width = Number(drawOptions.value[0]) || 3
    if (_width === -1) _width = 3
    return 60 * _width
  // テクスチャ
  } else if (drawType.value === 94) {
    let _width = Number(drawOptions.value[1]) || 1
    return 60 * _width - 1
  // 区切り線
  } else if (drawType.value === 95) {
    let _width = Number(drawOptions.value[0]) || 1
    if (_width === -1) _width = 1
    if (props.note.position === 0) _width = 5
    return 60 * _width
  // LED制御
  } else if (drawType.value === 96) return 40
  // その他
  else return 300
})

const isHiddenControl = computed(() => drawType.value === 95 && props.note.position === 0)

const noteTypeName = computed(() => noteTypes.find(t => t.value === props.note.type)?.title || `不明 (type: ${props.note.type})`)

const dispColor = computed(() => {
  if (drawType.value === 96) {
    if (Number(drawOptions.value[0]) === -1 && Number(drawOptions.value[1]) === -1 && Number(drawOptions.value[2]) === -1) {
      return 'linear-gradient(0deg, #ff5151 20%, #44a5ff 80%)'
    } else return `rgb(${drawOptions.value[0]},${drawOptions.value[1]},${drawOptions.value[2]})`
  }
  return null
})

const noteSpeed = computed(() => {
  if ([1, 2, 5].includes(drawType.value) && drawOptions.value[0]) return Number(drawOptions.value[0]) // TAP, ロング, 音札
  else if ([3, 4].includes(drawType.value) && drawOptions.value[3]) return Number(drawOptions.value[3]) // 左右フリック
  else if ([6, 7].includes(drawType.value) && drawOptions.value[3]) return Number(drawOptions.value[3]) // 上下フリック
  else if (drawType.value === 94 && drawOptions.value[5]) return Number(drawOptions.value[5]) // テクスチャ
  else if (drawType.value === 95 && drawOptions.value[1]) return Number(drawOptions.value[1]) // 区切り線
  return 1
})

const noteOrbit = computed(() => {
  if ([1, 2].includes(drawType.value) && drawOptions.value[1]) return Number(drawOptions.value[1]) // TAP, ロング
  else if ([3, 4].includes(drawType.value) && drawOptions.value[4]) return Number(drawOptions.value[4]) // 左右フリック
  else if ([6, 7].includes(drawType.value) && drawOptions.value[4]) return Number(drawOptions.value[4]) // 上下フリック
  else if (drawType.value === 94 && drawOptions.value[6]) return Number(drawOptions.value[6]) // テクスチャ
  else if (drawType.value === 95 && drawOptions.value[2]) return Number(drawOptions.value[2]) // 区切り線
  return 0
})

const getDuplicated = computed(() => isDuplicated(props.note, props.currentChart, [], { checkPreAppend: false }))
const getError = computed(() => hasError(props.note))
const getOptions = computed(() => noteOptions(props.note))
const getNoteTypes = computed(() => noteTypes)
const getIsLanelessNote = computed(() => isLanelessNote(props.note))
</script>

<style lang="scss" scoped>
.v-card {
  &__text {
    padding: 0;
    text-align: left;
  }
  .v-input {
    &--radio-group__input .v-radio {
      margin: 0;
    }
  }
}
</style>
