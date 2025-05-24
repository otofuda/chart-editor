<!-- eslint-disable vue/no-mutating-props -->
<template>
  <div class="mt-2">
    <v-row align="center" justify="space-between">
      <p class="mb-0">終点 #{{ index }}</p>
      <div>
        <v-btn color="primary" text dense @click="addEndToThis">
          <v-icon left>mdi-plus-circle-outline</v-icon>
          ここに終点を追加
        </v-btn>
        <v-btn color="error" text dense @click="deleteThisEnd">
          <v-icon left>mdi-delete</v-icon>
          この終点を削除
        </v-btn>
      </div>
    </v-row>
    <v-row class="mb-2">
      <v-col cols="12" sm="3">
        <v-select
          :items="[
            { text: '通常', value: 1 },
            { text: '終端なし', value: 89 }
          ]"
          hide-details
          label="type"
          v-model="end.type"
          outlined
          dense
          :menu-props="{
            rounded: 'lg'
          }"
        ></v-select>
      </v-col>
      <!-- <v-col cols="12" sm="3">
        <v-select
          :items="[1, 2, 3, 4, 5]"
          hide-details
          label="lane"
          v-model="end.lane"
          outlined
          dense
          :menu-props="{
            rounded: 'lg'
          }"
        ></v-select>
      </v-col> -->
      <v-col cols="12" sm="3">
        <v-text-field
          v-model.number="end.measure"
          label="measure"
          outlined
          dense
          hide-details
          type="number"
          min="0"
        ></v-text-field>
      </v-col>
      <v-col cols="12" sm="3">
        <v-text-field
          v-model.number="end.position"
          label="position"
          outlined
          dense
          hide-details
          min="0"
          :max="end.split - 1"
          background-color="#f0f0b0"
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
          outlined
          hide-details
          dense
          :menu-props="{
            rounded: 'lg'
          }"
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
        @delete-end="deleteChild"
      />
    </div>
  </div>
</template>

<script lang="ts">
import Vue, { PropType } from "vue";

// import EndForm from "./EndForm.vue";
import { LaneType, NoteData } from "chart-types";

export default Vue.extend({
  name: "EndForm",
  props: {
    end: {
      type: Object as PropType<NoteData>,
      required: true
    },
    parent: {
      type: Object as PropType<NoteData>,
      required: true
    },
    index: {
      type: Number,
      required: true
    },
    maxMeasure: {
      type: Number,
      required: true
    }
  },
  methods: {
    addEndToThis(): void {
      this.end.end.append({
        type: 1,
        lane: this.end.lane,
        measure: this.end.measure,
        position: Math.min(this.end.position + 1, this.end.split),
        split: this.end.split,
        option: [],
        end: []
      });
    },
    deleteThisEnd(): void {
      this.$emit("delete-end", this.index);
    },
    // 再帰の場合、自分の終点リストから子を消去
    deleteChild(index: number): void {
      this.end.end.delete_at(index);
    },
    // positionにフォーカスして終点移動
    endToLeft(): void {
      // eslint-disable-next-line vue/no-mutating-props
      this.end.lane = Math.max(this.end.lane - 1, 1) as LaneType;
      this.$emit("append-to-left", this.index);
    },
    endToRight(): void {
      // eslint-disable-next-line vue/no-mutating-props
      this.end.lane = Math.min(this.end.lane + 1, 5) as LaneType;
      this.$emit("append-to-right", this.index);
    },
    endToUp(event: KeyboardEvent): void {
      const note = this.end;
      if (note.split - 1 <= note.position) {
        note.measure++;
        note.position = 0;
      } else note.position++;
      // Shift同時押しで親も移動
      if (event.shiftKey) this.$emit("append-to-up", this.index);
    },
    endToDown(event: KeyboardEvent): void {
      const note = this.end;
      if (note.position === 0) {
        note.measure--;
        note.position = note.split - 1;
      } else note.position--;
      // Shift同時押しで親も移動
      if (event.shiftKey) this.$emit("append-to-down", this.index);
    },
    // App.vueの配置メソッドを発火
    placeNotes(): void {
      this.$emit("place-notes");
    }
  },
  computed: {
    // 親ノートの小節ベース座標
    parentPosition(): number {
      return this.parent.measure + this.parent.position / this.parent.split;
    },
    // 自分自身の小節ベース座標
    selfPosition(): number {
      return this.end.measure + this.end.position / this.end.split;
    },
    errors(): string[] {
      const array = new Array<string>();
      if (this.selfPosition <= this.parentPosition) {
        array.append("終点が親ノートよりも手前または同じ位置にあります。");
      }
      if (this.end.lane !== this.parent.lane) {
        array.append("終点と親ノートのレーン位置が異なります。");
      }
      if (this.end.measure > this.maxMeasure) {
        array.append(`存在しない小節に終点を配置できません(現在、譜面は${this.maxMeasure}小節まで)`);
      }
      return array;
    }
  }
});
</script>

<style lang="scss" scoped>
.recursive-end {
  border-left: 2px solid #909090;
  padding-left: 24px;
}
</style>
