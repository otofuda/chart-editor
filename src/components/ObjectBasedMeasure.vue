<template>
  <div class="object-based-measure">
    <h3>
      {{ measure.measure }}小節
      <span>
        {{ measure.measureBeat }}/4拍子・{{ measure.measureBpm }}BPM
      </span>
    </h3>
    <v-expansion-panels dark>
      <v-expansion-panel
        v-for="(note, i) in notes"
        :key="`note_${measure.measure}_${i}`"
      >
        <v-expansion-panel-header>
          #{{ note.index }} {{ noteTypeName(note) }}
          <span>（{{ note.position }}/{{ note.split }}）</span>
          <template v-if="hasError(note)" v-slot:actions>
            <v-icon color="error">
              mdi-alert-circle
            </v-icon>
          </template>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
          <v-alert type="error" v-if="hasError(note)">
            {{ hasError(note) }}
          </v-alert>
          <v-row>
            <v-col cols="12" sm="6">
              <v-select
                :items="noteTypes"
                hide-details
                label="ノート種別"
                v-model="note.type"
                align="left"
                outlined
                dense
              ></v-select>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="note.lane"
                label="lane"
                outlined
                dense
                hide-details
                type="number"
              ></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="note.position"
                label="position"
                outlined
                dense
                hide-details
                type="number"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="note.split"
                label="split"
                outlined
                dense
                hide-details
                type="number"
              ></v-text-field>
            </v-col>
          </v-row>

          <row v-for="(opt, i) in noteOptions(note)" :key="`option_${i}`">
            <v-text-field
              v-model="note.option[i]"
              hide-details
              :label="opt.label"
              :type="opt.type"
              class="mb-4"
              outlined
              dense
            ></v-text-field>
          </row>

          <!-- ロングノーツの時、終点を表示 -->
          <div class="object-based-measure__children" v-if="note.type === 2">
            <ObjectBasedMeasure
              :measure="{
                ...measure,
                measure: '[終点]',
                measureBeat: '-',
                measureBpm: '-'
              }"
              :notes="note.end"
            >
            </ObjectBasedMeasure>
          </div>

          <v-checkbox
            v-model="note.isSelected"
            label="選択"
            v-show="note.isSelected !== undefined"
          ></v-checkbox>
          <v-btn color="error" text @click="deleteNote(note)">
            <v-icon left>mdi-delete</v-icon>
            削除
          </v-btn>
          <v-btn text @click="showSnackbar(JSON.stringify(note, null, 2))">
            <v-icon>mdi-information</v-icon>
            ノート情報表示
          </v-btn>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script>
import noteTypes from "../mixins/noteTypes";
import noteCheck from "../mixins/noteCheck";
import ObjectBasedMeasure from "./ObjectBasedMeasure.vue";

export default {
  name: "ObjectBasedMeasure",
  mixins: [noteTypes, noteCheck],
  inject: ["deleteNotes", "showSnackbar"],
  components: {
    ObjectBasedMeasure
  },
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
    },
    currentDifficulty: {
      type: String,
      default: "easy"
    }
  },
  methods: {
    deleteNote(note) {
      this.deleteNotes(note.index);
      this.menu = false;
    },
    noteTypeName(note) {
      return this.noteTypes.find(t => t.value === note.type)?.text;
    }
  }
};
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
