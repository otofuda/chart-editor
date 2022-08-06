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
    <v-row>
      <v-col cols="12" sm="3">
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
      </v-col>
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
      >
      </EndForm>
    </div>
  </div>
</template>

<script>
import EndForm from "./EndForm.vue";

export default {
  name: "EndForm",
  props: {
    end: {
      type: Object,
      required: true
    },
    parent: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      required: true
    }
  },
  methods: {
    addEndToThis() {
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
    deleteThisEnd() {
      this.$emit("delete-end", this.index);
    },
    // 再帰の場合、自分の終点リストから子を消去
    deleteChild(index) {
      this.end.end.delete_at(index);
    },
    // positionにフォーカスして終点移動
    endToLeft() {
      // eslint-disable-next-line vue/no-mutating-props
      this.end.lane = Math.max(this.end.lane - 1, 1);
      this.$emit("append-to-left", this.index);
    },
    endToRight() {
      // eslint-disable-next-line vue/no-mutating-props
      this.end.lane = Math.min(this.end.lane + 1, 5);
      this.$emit("append-to-right", this.index);
    },
    endToUp(event) {
      const note = this.end;
      if (note.split - 1 <= note.position) {
        note.measure++;
        note.position = 0;
      } else note.position++;
      // Shift同時押しで親も移動
      if (event.shiftKey) this.$emit("append-to-up", this.index);
    },
    endToDown() {
      const note = this.end;
      if (note.position === 0) {
        note.measure--;
        note.position = note.split - 1;
      } else note.position--;
      // Shift同時押しで親も移動
      if (event.shiftKey) this.$emit("append-to-down", this.index);
    },
    // App.vueの配置メソッドを発火
    placeNotes() {
      this.$emit("place-notes");
    }
  },
  computed: {
    // 親ノートの小節ベース座標
    parentPosition() {
      return this.parent.measure + this.parent.position / this.parent.split;
    },
    // 自分自身の小節ベース座標
    selfPosition() {
      return this.end.measure + this.end.position / this.end.split;
    },
    errors() {
      const array = [];
      if (this.selfPosition <= this.parentPosition)
        array.append("終点が親ノートよりも手前または同じ位置にあります。");
      if (this.end.lane !== this.parent.lane)
        array.append("終点と親ノートのレーン位置が異なります。");
      return array;
    }
  },
  components: {
    EndForm
  }
};
</script>

<style lang="scss" scoped>
.recursive-end {
  border-left: 2px solid #909090;
  padding-left: 24px;
}
</style>
