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
    <template v-slot:activator="{ on, attrs }">
      <!-- 始点 -->
      <span
        class="note"
        :class="`type${note.type}`"
        :style="{
          left: `${getLeft(note)}px`,
          bottom: `${getBottom(note)}px`,
          width: `${getWidth(note)}px`
        }"
      >
        <input
          type="checkbox"
          v-model="note.isSelected"
          :id="note.index"
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
          v-bind="attrs"
          v-on="on"
        ></i>
      </div>
    </template>
    <v-card v-if="menu" rounded="lg">
      <v-list>
        <v-list-item>
          <v-card-text>#{{ note.index }} ロング</v-card-text>
          <v-spacer></v-spacer>
          <v-btn icon @click="menu = false" right>
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-list-item>
        <v-card-text class="ml-4">始点</v-card-text>
        <v-list-item>
          <v-row>
            <v-col>
              <v-text-field
                :value="note.measure"
                @change="value => (note.measure = Number(value))"
                hide-details
                suffix="小節"
                outlined
                dense
              ></v-text-field>
            </v-col>
          </v-row>
        </v-list-item>
        <v-list-item>
          <v-row>
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
          <v-card-text class="ml-4 mt-2">終点{{ i }}</v-card-text>
          <v-list-item>
            <v-row>
              <v-col>
                <v-text-field
                  :value="end.measure"
                  @change="value => (end.measure = Number(value))"
                  hide-details
                  suffix="小節"
                  outlined
                  dense
                ></v-text-field>
              </v-col>
            </v-row>
          </v-list-item>
          <v-list-item>
            <v-radio-group v-model="end.lane" row hide-details>
              <v-radio v-for="n in 5" :key="n" :value="n"></v-radio>
            </v-radio-group>
          </v-list-item>
          <v-list-item>
            <v-row>
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
        </div>
      </v-list>
      <v-card-actions class="pt-0">
        <v-btn color="error" text @click="deleteThisNote">
          <v-icon left>mdi-delete</v-icon> ノートを削除
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script>
export default {
  inject: ["deleteNotes"],
  data() {
    return {
      menu: false
    };
  },
  props: {
    note: {
      type: Object,
      required: true
    },
    measureData: {
      type: Array,
      required: true
    }
  },
  methods: {
    getLeft(note) {
      return (note.lane - 1) * 60 + 60;
    },
    getBottom(note) {
      return (
        this.measureData[note.measure].measurePositionBottom +
        (note.position / note.split) *
          this.measureData[note.measure].measureHeight
      );
    },
    getWidth() {
      return 60;
    },
    deleteThisNote() {
      this.deleteNotes(this.note.index);
      this.menu = false;
    }
  }
};
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
