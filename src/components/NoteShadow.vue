<template>
  <!-- note/endはtype 1, 2のみ想定 -->
  <div>
    <!-- 始点 -->
    <span
      :class="`type${note.type}`"
      :style="{
        left: `${getAbsoluteLeft(note)}px`,
        bottom: `${getAbsoluteBottom(note)}px`,
        width: `${getWidth(note)}px`
      }"
      >{{ note.position }}/{{ note.split }}</span
    >

    <div v-for="(end, i) in note.end" :key="i">
      <!-- 終点 -->
      <span
        :class="`type${end.type}`"
        :style="{
          left: `${getAbsoluteLeft(end)}px`,
          bottom: `${getAbsoluteBottom(end)}px`,
          width: `${getWidth(end)}px`
        }"
        >{{ note.position }}/{{ note.split }}</span
      >
      <!-- 帯 -->
      <i
        :style="{
          bottom: `${getAbsoluteBottom(note)}px`,
          left: `${getAbsoluteLeft(end)}px`,
          height: `${getAbsoluteBottom(end) - getAbsoluteBottom(note)}px`
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
      if ([1, 2, 95].includes(note.type)) {
        return (note.lane - 1) * 60;
      } else if ([3, 4].includes(note.type)) {
        let _width = note.option[0] || 3;
        if (_width === -1) _width = 3;
        let _left = (note.lane - 1) * 60 + 30;
        let _offset = 0;
        if (note.option[1] && note.option[2]) {
          _offset = (note.option[1] / note.option[2]) * 60;
        }
        return _left - (_width / 2) * 60 + _offset;
      } else {
        return 0;
      }
    },
    getAbsoluteLeft(note) {
      return this.getLeft(note) + 40;
    },
    getBottom(note) {
      const targetMeasure =
        this.measureData[note.measure] || this.measureData.last;
      return (note.position / note.split) * targetMeasure.measureHeight;
    },
    getAbsoluteBottom(note) {
      const targetMeasure =
        this.measureData[note.measure] || this.measureData.last;
      return (
        targetMeasure.measurePositionBottom +
        (note.position / note.split) * targetMeasure.measureHeight
      );
    },

    getWidth(note) {
      // TAP, ロング
      if ([1, 2].includes(note.type)) return 60;
      // 左右フリック
      else if ([3, 4].includes(note.type)) {
        let _width = note.option[0] || 3;
        if (_width === -1) _width = 3;
        return 60 * _width;
      }
      // 区切り線
      else if (note.type === 95) {
        let _width = note.option[0] || 1;
        if (_width === -1) _width = 1;
        if (note.position === 0) _width = 5;
        return 60 * _width;
      } else return 300;
    }
  }
};
</script>

<style lang="scss" scoped>
span {
  position: absolute;
  opacity: 0.5;
  color: #606060;
  background: linear-gradient(
    to left,
    transparent 3.99%,
    #ffffff 4%,
    #ffffff 96%,
    transparent 96.01%
  );
  height: 4px;
  overflow: visible;
  color: transparent;
  text-align: right;
  transition: 0.1s all ease;
  strong {
    color: #a0a0a0;
  }
  &:hover {
    color: #909090;
  }
  &.type2 {
    background: linear-gradient(
      to left,
      transparent 3.99%,
      #e9b75c 4%,
      #e9b75c 96%,
      transparent 96.01%
    );
    width: 60px;
  }
  &.type3 {
    height: 6px;
    background: #87cefa;
    &::before {
      content: "";
      display: inline-block;
      position: absolute;
      left: -10px;
      top: -7.5px;
      height: 0;
      width: 0;
      border-top: 10px solid transparent;
      border-right: 20px solid #87cefa;
      border-bottom: 10px solid transparent;
    }
  }
  &.type4 {
    height: 6px;
    background: #f08080;
    &::after {
      content: "";
      display: inline-block;
      position: absolute;
      right: -10px;
      top: -7.5px;
      height: 0;
      width: 0;
      border-top: 10px solid transparent;
      border-left: 20px solid #f08080;
      border-bottom: 10px solid transparent;
    }
  }
  &.type5 {
    height: 8px;
    background: linear-gradient(to right, gold, #fde08d, gold);
  }
  &.type95 {
    height: 1px;
    background: #a0a0a0;
    &.hidden {
      background: transparent;
    }
  }
  &.type97 {
    height: 1px;
    background: greenyellow;
  }
  &.type98 {
    height: 1px;
    background: yellow;
  }
  &.type99 {
    height: 0;
    border-top: 2px dashed #ff5050;
  }
}
i {
  position: absolute;
  background: #ffffec;
  opacity: 0.9;
  width: 38px;
  margin: 0 11px;
  border-left: 4px solid #6ecc6e;
  border-right: 4px solid #6ecc6e;
}
</style>
