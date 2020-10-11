<template>
  <!-- note/endはtype 1, 2のみ想定 -->
  <v-menu
    v-model="menu"
    :close-on-click="false"
    :close-on-content-click="false"
    absolute
    left
    :nudge-left="50"
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
        >{{ note.position }}/{{ note.split }}</span
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
          >{{ note.position }}/{{ note.split }}</span
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
    <v-card>
      <v-list>
        <v-list-item>
          <v-card-text>#{{ note.index }} ロング</v-card-text>
          <v-spacer></v-spacer>
          <v-btn icon @click="menu = false" right>
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-list-item>
      </v-list>
      <v-card-actions>
        <v-btn color="error" text @click="deleteThisNote">
          <v-icon left>mdi-delete</v-icon> ノートを削除
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script>
export default {
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
      this.$root.$children.first.deleteNote(this.note.index);
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
}
</style>
