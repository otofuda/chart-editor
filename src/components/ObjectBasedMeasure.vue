<template>
  <div class="object-based-measure" :class="{ 'is-child': isChild }">
    <h3>
      {{ measure.measure }}小節
      <span>
        {{ measure.measureBeat }}/4拍子・{{ measure.measureBpm }}BPM
      </span>
    </h3>
    <v-expansion-panels theme="dark">
      <v-expansion-panel
        v-for="(note, i) in notes"
        :key="`note_${measure.measure}_${getNoteKey(note, i)}`"
      >
        <v-expansion-panel-title>
          <template v-if="note.index !== undefined">#{{ note.index }} </template>
          {{ noteTypeName(note) }}
          <span>（{{ note.position }}/{{ note.split }}）</span>
          <template v-if="hasError(note)" v-slot:actions>
            <v-icon color="error">
              mdi-alert-circle
            </v-icon>
          </template>
        </v-expansion-panel-title>

        <v-expansion-panel-text>
          <v-alert type="error" v-if="hasError(note)" class="mb-3">
            {{ hasError(note) }}
          </v-alert>

          <v-text-field
            :model-value="getLocalMeasure(note, i)"
            @update:model-value="val => setLocalMeasure(note, i, Number(val))"
            @change="commitMeasure(note, i)"
            @keydown.enter.stop="commitMeasure(note, i)"
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
                step="0.1"
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

          <v-row v-for="(opt, optIdx) in noteOptions(note)" :key="`option_${optIdx}`" class="my-0">
            <v-text-field
              v-model="note.option[optIdx]"
              hide-details
              :label="opt.label"
              :type="opt.type"
              class="mb-4"
              variant="outlined"
              density="compact"
            ></v-text-field>
          </v-row>

          <!-- ロングノーツまたは終点ネストを持つ時、終点を表示 -->
          <div class="object-based-measure__children" v-if="note.type === 2 || (note.end && note.end.length > 0)">
            <ObjectBasedMeasure
              :measure="({ ...measure, measure: '[終点・中点]', measureBeat: '-', measureBpm: '-' } as any)"
              :notes="note.end"
              :is-child="true"
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
  isChild?: boolean
}>()

const deleteNotes = inject(deleteNotesKey)!
const showSnackbar = inject(showSnackbarKey)!

const localMeasures = ref<Record<string, number>>({})

function getNoteKey(note: ExtendedNoteData, index: number): string {
  return note.index !== undefined ? String(note.index) : `${props.measure.measure}_${note.position}_${index}`
}

function getLocalMeasure(note: ExtendedNoteData, index: number) {
  const key = getNoteKey(note, index)
  if (localMeasures.value[key] === undefined) {
    localMeasures.value[key] = note.measure
  }
  return localMeasures.value[key]
}

function setLocalMeasure(note: ExtendedNoteData, index: number, val: number) {
  const key = getNoteKey(note, index)
  localMeasures.value[key] = val
}

function commitMeasure(note: ExtendedNoteData, index: number) {
  const key = getNoteKey(note, index)
  note.measure = localMeasures.value[key]
}

function deleteNote(note: ExtendedNoteData) {
  if (note.index !== undefined) {
    deleteNotes(note.index)
  }
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
  width: 100%;
  box-sizing: border-box;

  h3 {
    padding: 8px 4px;
    font-size: 1.1rem;
    span {
      color: #909090;
      font-size: 0.9rem;
      font-weight: normal;
    }
  }

  &__children {
    margin-top: 8px;
    margin-bottom: 8px;
    padding-left: 8px;
    border-left: 2px solid rgba(255, 255, 255, 0.2);
  }

  :deep(.v-expansion-panel-text__wrapper) {
    padding: 8px 8px;
  }

  :deep(.v-expansion-panel-title) {
    padding: 8px 12px;
    min-height: 40px;
  }
}
</style>
