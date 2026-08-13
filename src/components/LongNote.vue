<!-- eslint-disable vue/no-mutating-props -->
<template>
  <!-- note/endはtype 1, 2のみ想定 -->
  <v-menu
    v-model="menu"
    :close-on-click="false"
    :close-on-content-click="false"
    absolute
    left
    :max-width="240"
  >
    <template v-slot:activator="{ props }">
      <!-- 始点 -->
      <span
        class="note"
        :class="{
          [`type${drawType}`]: true,
          isDummy: note.type === 90,
        }"
        :style="{
          left: `${getLeft(note)}px`,
          bottom: `${getBottom(note)}px`,
          width: `${getWidth(note)}px`
        }"
        v-bind="props"
      >
        <input
          type="checkbox"
          v-model="note.isSelected"
          :id="String(note.index)"
          @click.stop
        />{{ note.position }}/{{ note.split }}</span
      >

      <div v-for="(end, i) in note.end" :key="i">
        <!-- 終点 -->
        <span
          class="note"
          :class="`type${end.type}`"
          :style="{
            left: `${getLeft(end)}px`,
            bottom: `${getBottom(end)}px`,
            width: `${getWidth(end)}px`
          }"
          >{{ end.position }}/{{ end.split }}</span
        >
        <!-- 帯 -->
        <i
          class="note-hold"
          :style="{
            bottom: `${getBottom(note)}px`,
            left: `${getLeft(end)}px`,
            height: `${getBottom(end) - getBottom(note)}px`
          }"
          v-bind="props"
        ></i>
      </div>
    </template>

    <!-- ポップアップ編集 -->
    <v-card v-if="menu" rounded="lg">
      <v-list>
        <v-list-item>
          <v-card-text>
            #{{ note.index }}
            ロング
            {{ note.type === 90 ? "(ダミー)" : "" }}
          </v-card-text>
          <v-spacer></v-spacer>
          <v-btn icon @click="menu = false" right>
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-list-item>
        <v-card-text class="ml-4">始点</v-card-text>
        <v-list-item>
          <v-text-field
            v-model.number="localMeasure"
            @change="note.measure = localMeasure"
            hide-details
            suffix="小節"
            outlined
            dense
            type="number"
            min="0"
          ></v-text-field>
        </v-list-item>
        <v-list-item>
          <v-row class="mb-0">
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="note.position"
                label="position"
                outlined
                dense
                hide-details
                type="number"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="note.split"
                label="split"
                outlined
                dense
                hide-details
                type="number"
              ></v-text-field>
            </v-col>
          </v-row>
        </v-list-item>
        <v-list-item>
          LANE
          <v-spacer></v-spacer>
          <v-radio-group v-model="note.lane" row hide-details>
            <v-radio v-for="n in 5" :key="n" :value="n"></v-radio>
          </v-radio-group>
        </v-list-item>

        <!-- 終点のレーン(浅い一覧) -->
        <div
          v-for="(end, i) in note.end"
          :key="`longnote_end_${note.index}_${i}`"
        >
          <v-divider></v-divider>
          <v-card-text class="ml-4 mt-2">終点 #{{ i }}</v-card-text>
          <v-list-item>
            <v-text-field
              v-model.number="localEndMeasures[i]"
              @change="end.measure = localEndMeasures[i]"
              hide-details
              suffix="小節"
              outlined
              dense
              type="number"
              min="0"
            ></v-text-field>
          </v-list-item>
          <v-list-item>
            LANE
            <v-spacer></v-spacer>
            <v-radio-group v-model="end.lane" row hide-details>
              <v-radio v-for="n in 5" :key="n" :value="n"></v-radio>
            </v-radio-group>
          </v-list-item>
          <v-list-item>
            <v-row class="mb-0">
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="end.position"
                  label="position"
                  outlined
                  dense
                  hide-details
                  type="number"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="end.split"
                  label="split"
                  outlined
                  dense
                  hide-details
                  type="number"
                ></v-text-field>
              </v-col>
            </v-row>
          </v-list-item>
          <v-list-item>
            終端
            <v-spacer></v-spacer>
            <v-radio-group v-model="end.type" row hide-details>
              <v-radio label="あり" :value="1" class="ml-2"></v-radio>
              <v-radio label="なし" :value="89" class="ml-2"></v-radio>
            </v-radio-group>
          </v-list-item>
        </div>

        <v-alert
          v-if="note.end.length === 0"
          class="mx-4 mb-0"
          dense
          type="warning"
          rounded="lg"
        >
          終点が1つもありません
        </v-alert>
      </v-list>
      <v-card-actions class="pt-0">
        <v-btn color="error" text @click="deleteThisNote">
          <v-icon left>mdi-delete</v-icon> ノートを削除
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { ref, computed, inject, watch } from 'vue'
import { type ExtendedNoteData, type Measure } from '@/types'
import { deleteNotesKey } from '@/composables/injectionKeys'

const props = defineProps<{
  note: ExtendedNoteData
  measureData: Measure[]
}>()

const deleteNotes = inject(deleteNotesKey)!

const menu = ref(false)
const localMeasure = ref(props.note.measure)
const localEndMeasures = ref<number[]>([])

watch(menu, (isOpen) => {
  if (isOpen) {
    localMeasure.value = props.note.measure
    localEndMeasures.value = props.note.end.map(end => end.measure)
  } else {
    props.note.measure = localMeasure.value
    props.note.end.forEach((end, idx) => {
      if (localEndMeasures.value[idx] !== undefined) {
        end.measure = localEndMeasures.value[idx]
      }
    })
  }
})

function getLeft(note: ExtendedNoteData) {
  return (note.lane - 1) * 60 + 60
}

function getBottom(note: ExtendedNoteData) {
  return (
    props.measureData[note.measure].measurePositionBottom +
    (note.position / note.split) * props.measureData[note.measure].measureHeight
  )
}

function getWidth(_note: ExtendedNoteData) {
  return 60
}

function deleteThisNote() {
  deleteNotes(props.note.index)
  menu.value = false
}

const drawType = computed(() => {
  if (props.note.type === 90) return Number(props.note.option[0])
  return props.note.type
})

const drawOptions = computed(() => {
  if (props.note.type === 90) return props.note.option.slice(1)
  return props.note.option
})
</script>

<style lang="scss" scoped>
.v-card {
  &__text {
    padding: 0;
    text-align: left;
  }
  .v-input {
    margin-top: 0;
    &--radio-group__input .v-radio {
      margin: 0;
    }
  }
}
</style>
