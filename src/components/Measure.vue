<template>
  <div
    :style="{
      bottom: `${measure.measurePositionBottom}px`,
      height: `${measure.measureHeight}px`
    }"
    class="measure"
    :class="{
      hiddenControl: notes.find(note => note.type === 95 && note.position === 0),
      isStop: notes.find(note => note.type === 92)
    }"
  >
    <v-menu offset-y :close-on-content-click="false">
      <template v-slot:activator="{ props }">
        <v-btn
          icon
          size="small"
          variant="text"
          v-bind="props"
          @click="
            copyToDifficulty = currentDifficulty;
            copyToMeasure = measure.measure;
          "
        >
          <v-icon>mdi-dots-vertical</v-icon>
        </v-btn>
      </template>

      <v-list density="compact">
        <v-list-item>
          <v-list-item-title>
            <strong>{{ measure.measure }} 小節</strong>
            （{{ notes.length }} OBJ）
          </v-list-item-title>
        </v-list-item>
        <v-list-item>
          到達時間：{{ measure.measureReachTime.toFixed(4) }}ms
        </v-list-item>
        <v-divider></v-divider>
        <v-list-item><strong>小節内のノーツを</strong></v-list-item>
        <v-list-item class="px-0 mx-2">
          <v-btn color="primary" variant="text" prepend-icon="mdi-select" @click="selectAll">
            全て選択
          </v-btn>
          <v-btn color="warning" variant="text" prepend-icon="mdi-select-off" @click="clearAll">
            全て選択解除
          </v-btn>
        </v-list-item>
        <v-divider></v-divider>
        <v-list-item>
          <strong>{{ measure.measure }}小節内のノーツを対象に</strong>
        </v-list-item>
        <v-list-item class="px-0 mx-2">
          <v-select
            :items="difficulties"
            label="複製先難易度"
            class="mt-2"
            v-model="copyToDifficulty"
            hide-details
            variant="outlined"
            density="compact"
          ></v-select>
        </v-list-item>
        <v-list-item class="px-0 mx-2">
          <v-text-field
            v-model.number="copyToMeasure"
            hide-details
            label="複製先小節"
            class="mt-2"
            variant="outlined"
            density="compact"
          ></v-text-field>
        </v-list-item>
        <v-list-item class="px-0 mx-2">
          小節に
          <v-spacer></v-spacer>
          <v-btn color="primary" prepend-icon="mdi-content-copy" variant="text" @click="copyAll">
            複製
          </v-btn>
          <v-btn color="warning" prepend-icon="mdi-content-cut" variant="text" @click="moveAll">
            移動
          </v-btn>
        </v-list-item>
        <v-list-item class="px-0 mx-2">
          Option：
          <v-radio-group v-model="copyOrMoveOnlySelected" hide-details>
            <v-radio label="すべてのノーツを対象" :value="false"></v-radio>
            <v-radio label="チェック済みのみ対象" :value="true"></v-radio>
          </v-radio-group>
        </v-list-item>
      </v-list>
    </v-menu>

    <span
      class="measure__separator"
      v-for="n in 4"
      :key="n"
      :style="{
        left: `${n * 60 - 1}px`,
        height: `${measure.measureHeight}px`
      }"
    ></span>

    <span class="measure__number" v-text="measure.measure"></span>

    <Note
      v-for="(note, i) in dispNotes"
      :key="`note_${measure.measure}_${i}`"
      :note="note"
      :measure="measure"
      :currentChart="notes"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import { type DifficultyString, type ExtendedNoteData, type Measure } from '@/types'
import Note from './Note.vue'
import {
  deleteNotesKey, appendNotesKey, showSnackbarKey, getMovedNoteKey, copyNotesToDifficultyKey,
} from '@/composables/injectionKeys'

const props = defineProps<{
  notes?: ExtendedNoteData[]
  measure: Measure
  currentDifficulty?: DifficultyString
}>()

const deleteNotes = inject(deleteNotesKey)!
const appendNotes = inject(appendNotesKey)!
const showSnackbar = inject(showSnackbarKey)!
const getMovedNote = inject(getMovedNoteKey)!
const copyNotesToDifficulty = inject(copyNotesToDifficultyKey)!

const difficulties = ['raku', 'easy', 'normal', 'hard', 'extra'] as DifficultyString[]
const copyToDifficulty = ref<DifficultyString>(props.currentDifficulty ?? 'easy')
const copyToMeasure = ref(0)
const copyOrMoveOnlySelected = ref(false) // チェック済みのみ複製・移動するか

const notesList = computed(() => props.notes ?? [])

// 小節内のノーツをすべて選択
function selectAll() {
  notesList.value.forEach((note: ExtendedNoteData) => { note.isSelected = true })
}

// 小節内のノーツをすべて選択解除
function clearAll() {
  notesList.value.forEach((note: ExtendedNoteData) => { note.isSelected = false })
}

// 小節内のノーツをすべて複製
function copyAll() {
  let targets = notesList.value.filter(note => note.type !== 2)
  // チェック済みのみ複製する場合のフィルター
  if (copyOrMoveOnlySelected.value) targets = targets.filter(note => note.isSelected)
  if ((props.currentDifficulty ?? 'easy') === copyToDifficulty.value) {
    appendNotes(...targets.map(note => getMovedNote({ ...note }, copyToMeasure.value)))
    showSnackbar(`対象の${targets.length}ノーツに対して、${props.measure.measure}小節 => ${copyToMeasure.value}小節へ複製処理を行いました（ロングノーツを除く）`)
  } else {
    // 各movedNoteを取得して対象難易度に複製
    copyNotesToDifficulty(copyToDifficulty.value, ...targets.map(note => getMovedNote({ ...note }, copyToMeasure.value)))
  }
}

// 小節内のノーツをすべて移動
function moveAll() {
  let targets = notesList.value.filter(note => note.type !== 2)
  // チェック済みのみ移動する場合のフィルター
  if (copyOrMoveOnlySelected.value) targets = targets.filter(note => note.isSelected)
  const idx = targets.map(note => note.index)
  if ((props.currentDifficulty ?? 'easy') === copyToDifficulty.value) {
    appendNotes(...targets.map(note => getMovedNote({ ...note }, copyToMeasure.value)))
    deleteNotes(...idx)
    showSnackbar(`対象の${targets.length}ノーツに対して、${props.measure.measure}小節 => ${copyToMeasure.value}小節へ移動処理を行いました（ロングノーツを除く）`)
  } else {
    // 各movedNoteを取得して対象難易度に複製
    copyNotesToDifficulty(copyToDifficulty.value, ...targets.map(note => getMovedNote({ ...note }, copyToMeasure.value)))
    deleteNotes(...idx)
  }
}

const dispNotes = computed(() =>
  notesList.value.filter(note => note.type !== 2 && !(note.type === 90 && note.option[0] === '2'))
)
</script>

<style lang="scss" scoped>
.measure {
  width: 300px;
  background: #303030;
  color: #ffffff;
  position: absolute;
  right: 60px;

  &:not(.hiddenControl) {
    box-shadow: inset 0 -1px 0 0 #a0a0a0;
  }

  &.isStop {
    background: #572828;
  }

  &__separator {
    position: absolute;
    background: #606060;
    width: 1px;
  }

  &__number {
    position: absolute;
    bottom: 0;
    left: 100%;
    color: #c0c0c0;
    font-size: 20px;
  }

  .v-btn--icon {
    color: #c0c0c0;
    position: absolute;
    right: calc(100% + 4px);
  }
}
</style>
