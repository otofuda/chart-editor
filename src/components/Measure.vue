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
    <v-menu offset-y :close-on-content-click="false" rounded="lg">
      <template v-slot:activator="{ on, attrs }">
        <v-btn
          dark
          icon
          v-bind="attrs"
          v-on="on"
          @click="
            copyToDifficulty = currentDifficulty;
            copyToMeasure = measure.measure;
          "
        >
          <v-icon>mdi-dots-vertical</v-icon>
        </v-btn>
      </template>

      <v-list>
        <v-list-item>
          <v-list-item-title>
            <strong>{{ measure.measure }} 小節</strong>
            （{{ notes.size }} OBJ）
          </v-list-item-title>
        </v-list-item>
        <v-list-item>
          到達時間：{{ measure.measureReachTime.toFixed(4) }}ms
        </v-list-item>
        <v-divider></v-divider>
        <v-list-item><strong>小節内のノーツを</strong></v-list-item>
        <v-list-item class="px-0 mx-2">
          <v-btn color="primary" text dense @click="selectAll">
            <v-icon left>mdi-select</v-icon> 全て選択
          </v-btn>
          <v-btn color="warning" text dense @click="clearAll">
            <v-icon left>mdi-select-off</v-icon> 全て選択解除
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
            v-model="copyToDifficulty"
            align="left"
            hide-details
            outlined
            dense
            :menu-props="{ rounded: 'lg' }"
          ></v-select>
        </v-list-item>
        <v-list-item class="px-0 mx-2">
          <v-text-field
            v-model.number="copyToMeasure"
            hide-details
            label="複製先小節"
            outlined
            dense
          ></v-text-field>
        </v-list-item>
        <v-list-item class="px-0 mx-2">
          小節に
          <v-spacer></v-spacer>
          <v-btn color="primary" text dense @click="copyAll">
            <v-icon left>mdi-content-copy</v-icon> 複製
          </v-btn>
          <v-btn color="warning" text dense @click="moveAll">
            <v-icon left>mdi-content-cut</v-icon> 移動
          </v-btn>
        </v-list-item>
        <v-list-item class="px-0 mx-2 mb-2">
          Option：
          <v-radio-group v-model="copyOrMoveOnlySelected" hide-details="">
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
      v-for="(note, i) in notes.filter(n => n.type !== 2)"
      :key="`note_${measure.measure}_${i}`"
      :note="note"
      :measure="measure"
      :currentChart="notes"
    />
  </div>
</template>

<script lang="ts">
import Vue, { PropType } from "vue";
import { DifficultyString, ExtendedNoteData, Measure } from "@/types";

import Note from "./Note.vue";

export default Vue.extend({
  name: "MeasureComponent",
  inject: [
    "deleteNotes",
    "appendNotes",
    "showSnackbar",
    "getMovedNote",
    "copyNotesToDifficulty"
  ],
  props: {
    notes: {
      type: Array as PropType<ExtendedNoteData[]>,
      default: () => []
    },
    measure: {
      type: Object as PropType<Measure>,
      required: true
    },
    currentDifficulty: {
      type: String as PropType<DifficultyString>,
      default: "easy"
    }
  },
  data() {
    return {
      difficulties: ["raku", "easy", "normal", "hard", "extra"],
      copyToDifficulty: this.currentDifficulty,
      copyToMeasure: 0,
      copyOrMoveOnlySelected: false // チェック済みのみ複製・移動するか
    };
  },
  methods: {
    // 小節内のノーツをすべて選択
    selectAll() {
      this.notes.each((note: ExtendedNoteData) => {
        note.isSelected = true;
      });
    },
    // 小節内のノーツをすべて選択解除
    clearAll() {
      this.notes.each((note: ExtendedNoteData) => {
        note.isSelected = false;
      });
    },
    // 小節内のノーツをすべて複製
    copyAll() {
      let targets = this.notes.filter(note => note.type !== 2);
      // チェック済みのみ複製する場合のフィルター
      if (this.copyOrMoveOnlySelected) {
        targets = targets.filter(note => note.isSelected);
      }
      // const idx = targets.map(note => note.index);
      if (this.currentDifficulty === this.copyToDifficulty) {
        // @ts-ignore "appendNotes" (inject)
        this.appendNotes(
          ...targets.map(note => {
            // @ts-ignore "getMovedNote" (inject)
            return this.getMovedNote({ ...note }, this.copyToMeasure)
          }
          )
        );
        // @ts-ignore "showSnackbar" (inject)
        this.showSnackbar(
          `対象の${targets.size}ノーツに対して、${this.measure.measure}小節 => ${this.copyToMeasure}小節へ複製処理を行いました（ロングノーツを除く）`
        );
      } else {
        // 各movedNoteを取得して対象難易度に複製
        // @ts-ignore "copyNotesToDifficulty" (inject)
        this.copyNotesToDifficulty(
          this.copyToDifficulty,
          ...targets.map(note => {
            // @ts-ignore "getMovedNote" (inject)
            return this.getMovedNote({ ...note }, this.copyToMeasure)
          }
          )
        );
      }
    },
    // 小節内のノーツをすべて移動
    moveAll() {
      let targets = this.notes.filter(note => note.type !== 2);
      // チェック済みのみ移動する場合のフィルター
      if (this.copyOrMoveOnlySelected) {
        targets = targets.filter(note => note.isSelected);
      }
      const idx = targets.map(note => note.index);
      if (this.currentDifficulty === this.copyToDifficulty) {
        // @ts-ignore "appendNotes" (inject)
        this.appendNotes(
          ...targets.map(note => {
            // @ts-ignore "getMovedNote" (inject)
            return this.getMovedNote({ ...note }, this.copyToMeasure)
          })
        );
        // @ts-ignore "deleteNotes" (inject)
        this.deleteNotes(...idx);
        // @ts-ignore "showSnackbar" (inject)
        this.showSnackbar(
          `対象の${targets.size}ノーツに対して、${this.measure.measure}小節 => ${this.copyToMeasure}小節へ移動処理を行いました（ロングノーツを除く）`
        );
      } else {
        // 各movedNoteを取得して対象難易度に複製
        // @ts-ignore "copyNotesToDifficulty" (inject)
        this.copyNotesToDifficulty(
          this.copyToDifficulty,
          ...targets.map(note => {
            // @ts-ignore "getMovedNote" (inject)
            return this.getMovedNote({ ...note }, this.copyToMeasure)
          })
        );
        // @ts-ignore "deleteNotes" (inject)
        this.deleteNotes(...idx);
      }
    }
  },
  components: {
    Note
  }
});
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
