<template>
  <span
    :class="{
      [`type${note.type}`]: true,
      hidden: isHiddenControl
    }"
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
  computed: {
    positionLeft() {
      if ([1, 2, 95].includes(this.note.type)) {
        return (this.note.lane - 1) * 60;
      } else if ([3, 4].includes(this.note.type)) {
        let _width = this.note.option[0] || 3;
        if (_width === -1) _width = 3;
        let _left = (this.note.lane - 1) * 60 + 30;
        let _offset = 0;
        if (this.note.option[1] && this.note.option[2]) {
          _offset = (this.note.option[1] / this.note.option[2]) * 60;
        }
        return _left - (_width / 2) * 60 + _offset;
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
      // TAP, ロング
      if ([1, 2].includes(this.note.type)) return 60;
      // 左右フリック
      else if ([3, 4].includes(this.note.type)) {
        let _width = this.note.option[0] || 3;
        if (_width === -1) _width = 3;
        return 60 * _width;
      }
      // 区切り線
      else if (this.note.type === 95) {
        let _width = this.note.option[0] || 1;
        if (_width === -1) _width = 1;
        if (this.note.position === 0) _width = 5;
        return 60 * _width;
      } else return 300;
    },
    isHiddenControl() {
      return this.note.type === 95 && this.note.position === 0;
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
  }
  &.type3 {
    height: 6px;
    background: #87cefa;
  }
  &.type4 {
    height: 6px;
    background: #f08080;
  }
  &.type5 {
    height: 8px;
    background: linear-gradient(to right, gold, #fde08d, gold);
  }
  &.type95 {
    height: 1px;
    background: #606060;
    &.hidden {
      background: transparent;
    }
  }
}
</style>
