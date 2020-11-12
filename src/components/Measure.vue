<template>
  <div
    :style="{
      bottom: `${measure.measurePositionBottom}px`,
      height: `${measure.measureHeight}px`
    }"
    class="measure"
    :class="{
      hiddenControl: notes.find(note => note.type === 95 && note.position === 0)
    }"
  >
    <v-menu offset-y :close-on-content-click="false">
      <template v-slot:activator="{ on, attrs }">
        <v-btn dark icon v-bind="attrs" v-on="on">
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

<script>
import Note from "./Note.vue";

export default {
  inject: ["deleteNotes", "appendNotes", "showSnackbar"],
  props: {
    notes: {
      type: Array,
      default: () => []
    },
    measure: {
      type: Object,
      required: true
    },
    measureData: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      copyToMeasure: 0
    };
  },
  methods: {
    // 小節内のノーツをすべて選択
    selectAll() {
      this.notes.each(note => {
        note.isSelected = true;
      });
    },
    // 小節内のノーツをすべて選択解除
    clearAll() {
      this.notes.each(note => {
        note.isSelected = false;
      });
    },
    // 小節内のノーツをすべて複製
    copyAll() {
      this.appendNotes(
        ...this.notes.map(note =>
          this.getMovedNote({ ...note }, this.copyToMeasure)
        )
      );
      this.showSnackbar(
        `${this.measure.measure}小節から${this.copyToMeasure}小節へ複製処理を行いました`
      );
    },
    // 小節内のノーツをすべて移動
    moveAll() {
      const idx = this.notes.map(note => note.index);
      this.appendNotes(
        ...this.notes.map(note =>
          this.getMovedNote({ ...note }, this.copyToMeasure)
        )
      );
      this.deleteNotes(...idx);
      this.showSnackbar(
        `${this.measure.measure}小節から${this.copyToMeasure}小節へ移動処理を行いました`
      );
    },
    getMovedNote(oldNote, newMeasure) {
      const diff = newMeasure - oldNote.measure;
      return {
        ...oldNote,
        measure: newMeasure,
        end: oldNote.end.map(end => {
          this.getMovedNote({ ...end }, (newMeasure = diff));
        })
      };
    }
  },
  components: {
    Note
  }
};
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
