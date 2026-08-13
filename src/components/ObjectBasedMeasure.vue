<template>
  <div class="object-based-measure">
    <h3>
      {{ measure.measure }}小節
      <span>
        {{ measure.measureBeat }}/4拍子・{{ measure.measureBpm }}BPM
      </span>
    </h3>
    <v-expansion-panels theme="dark">
      <v-expansion-panel
        v-for="(note, i) in notes"
        :key="`note_${measure.measure}_${i}`"
      >
        <v-expansion-panel-title>
          #{{ note.index }} {{ noteTypeName(note) }}
          <span>（{{ note.position }}/{{ note.split }}）</span>
          <template v-if="hasError(note)" v-slot:actions>
            <v-icon color="error">
              mdi-alert-circle
            </v-icon>
          </template>
        </v-expansion-panel-title>

        <v-expansion-panel-text>
          <v-alert type="error" v-if="hasError(note)">
            {{ hasError(note) }}
          </v-alert>

          <v-text-field
            :model-value="getLocalMeasure(note)"
            @update:model-value="val => setLocalMeasure(note, Number(val))"
            @change="commitMeasure(note)"
            @keydown.enter.stop="commitMeasure(note)"
            label="小節"
            variant="outlined"
            density="compact"
            hide-details
            type="number"
          ></v-text-field>

          <v-row class="mt-4">
            <v-col cols="12" sm="6">
              <v-select
                :items="noteTypes"
                hide-details
                label="ノート種別"
                v-model="note.type"
                align="left"
                variant="outlined"
                density="compact"
              ></v-select>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="note.lane"
                label="lane"
                variant="outlined"
                density="compact"
                hide-details
                type="number"
              ></v-text-field>
            </v-col>
          </v-row>

          <v-row class="my-4">
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

          <v-row v-for="(opt, i) in noteOptions(note)" :key="`option_${i}`" class="my-0">
            <v-text-field
              v-model="note.option[i]"
              hide-details
              :label="opt.label"
              :type="opt.type"
              class="mb-4"
              variant="outlined"
              density="compact"
            ></v-text-field>
          </v-row>

          <!-- ロングノーツの時、終点を表示 -->
          <div class="object-based-measure__children" v-if="note.type === 2">
            <ObjectBasedMeasure
              :measure="({ ...measure, measure: '[終点]', measureBeat: '-', measureBpm: '-' } as any)"
              :notes="note.end"
            ></ObjectBasedMeasure>
          </div>

          <v-checkbox
            v-model="note.isSelected"
            label="選択"
            v-show="note.isSelected !== undefined"
            density="compact"
            hide-details
          ></v-checkbox>
          <v-btn color="error" variant="text" @click="deleteNote(note)" prepend-icon="mdi-delete">
            削除
          </v-btn>
          <v-btn variant="text" @click="showSnackbar(JSON.stringify(note, null, 2))" prepend-icon="mdi-information">
            ノート情報表示
          </v-btn>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue'
import { type DifficultyString, type ExtendedNoteData, type Measure } from '@/types'
import { noteTypes, noteOptions } from '@/composables/useNoteTypes'
import { hasError } from '@/composables/useNoteCheck'
import { deleteNotesKey, showSnackbarKey } from '@/composables/injectionKeys'

const props = defineProps<{
  notes?: ExtendedNoteData[]
  measure: Measure
  measureData?: any[]
  currentDifficulty?: DifficultyString
}>()

const menu = ref(false)
const deleteNotes = inject(deleteNotesKey)!
const showSnackbar = inject(showSnackbarKey)!

const localMeasures = ref<Record<number, number>>({})

function getLocalMeasure(note: ExtendedNoteData) {
  if (localMeasures.value[note.index] === undefined) {
    localMeasures.value[note.index] = note.measure
  }
  return localMeasures.value[note.index]
}

function setLocalMeasure(note: ExtendedNoteData, val: number) {
  localMeasures.value[note.index] = val
}

function commitMeasure(note: ExtendedNoteData) {
  note.measure = localMeasures.value[note.index]
}

function deleteNote(note: ExtendedNoteData) {
  deleteNotes(note.index)
}

function noteTypeName(note: ExtendedNoteData) {
  if (note.type !== 90) {
    return noteTypes.find(t => t.value === note.type)?.title || '---'
  } else {
    return 'ダミー ' + noteTypes.find(t => String(t.value) === note.option[0])?.title
  }
}
</script>

<style lang="scss" scoped>
.object-based-measure {
  color: #f0f0f0;
  margin-left: calc(100% - 420px);
  max-width: 100%;
  min-width: 200px;
  h3 {
    padding: 8px;
    span {
      color: #909090;
      font-size: 16px;
      font-weight: normal;
    }
  }
  &__children {
    position: relative;
    left: 80px;
  }
}
</style>
