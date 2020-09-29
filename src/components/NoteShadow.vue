<template>
  <!-- note/endはtype 1, 2のみ想定 -->
  <div>
    <!-- 始点 -->
    <span
      class="note"
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
        class="note"
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
        class="note-hold"
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
  opacity: 0.5;
}
</style>
