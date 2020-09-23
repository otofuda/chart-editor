<template>
  <span
    :class="`type${note.type}`"
    :style="{
      left: `${positionLeft}px`,
      bottom: `${positionBottom}px`,
      width: `${noteWidth}px`
    }"
    >{{ note.position }}/{{ note.split }}</span
  >
</template>

<script>
export default {
  data() {
    return {};
  },
  props: {
    note: {
      type: Object,
      required: true
    },
    measure: {
      type: Object,
      required: true
    }
  },
  methods: {},
  computed: {
    positionLeft() {
      if ([1, 2, 95].includes(this.note.type)) {
        return (this.note.lane - 1) * 60;
      } else {
        return 0;
      }
    },
    positionBottom() {
      return (
        (this.note.position / this.note.split) * this.measure.measureHeight
      );
    },
    noteWidth() {
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
  height: 3px;
  overflow: visible;
}
</style>
