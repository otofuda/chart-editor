<template>
  <!-- note/endはtype 1, 2のみ想定 -->
  <div>
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
      ></i>
    </div>
  </div>
</template>

<script>
export default {
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
      return (note.lane - 1) * 60 + 40;
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
    }
  }
};
</script>

<style lang="scss" scoped></style>
