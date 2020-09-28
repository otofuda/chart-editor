<template>
  <!-- note/endはtype 1, 2のみ想定 -->
  <div>
    <!-- 始点 -->
    <span
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

<style lang="scss" scoped>
span {
  position: absolute;
  color: #606060;
  background: #f0f0f0;
  height: 4px;
  overflow: visible;
  color: transparent;
  &:hover {
    color: #909090;
  }
  &.type2 {
    background: #e9b75c;
    width: 60px;
  }
}
i {
  position: absolute;
  background: #ffffec;
  opacity: 0.9;
  width: 40px;
  margin: 0 10px;
  border-left: 4px solid #6ecc6e;
  border-right: 4px solid #6ecc6e;
}
</style>