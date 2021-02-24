<template>
  <!-- note/endはtype 1, 2のみ想定 -->
  <div>
    <!-- 始点 -->
    <span
      class="note"
      :class="{
        [`type${note.type}`]: true,
        shadow: !isPreAppend,
        preappend: isPreAppend
      }"
      :style="{
        left: `${getAbsoluteLeft(note)}px`,
        bottom: `${getAbsoluteBottom(note)}px`,
        width: `${getWidth(note)}px`,
        background: dispColor
      }"
      @click="calcelThisNote"
    >
      <img
        v-if="note.type === 94"
        :src="note.option[0]"
        :style="{
          height: `${this.measureData.last.measureHeight * note.option[2]}px`
        }"
        alt="texture"
      />
      {{ note.position }}/{{ note.split }}
      <span v-if="isPreAppend" class="preappend__index">#{{ note.index }}</span>
    </span>

    <div v-for="(end, i) in note.end" :key="i">
      <!-- 終点 -->
      <span
        class="note"
        :class="{
          [`type${end.type}`]: true,
          shadow: !isPreAppend,
          preappend: isPreAppend
        }"
        :style="{
          left: `${getAbsoluteLeft(end)}px`,
          bottom: `${getAbsoluteBottom(end)}px`,
          width: `${getWidth(end)}px`
        }"
      >
        {{ end.position }}/{{ end.split }}
      </span>
      <!-- 帯 -->
      <i
        class="note-hold"
        :class="{
          shadow: !isPreAppend,
          preappend: isPreAppend
        }"
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
  inject: ["cancelNote"],
  props: {
    note: {
      type: Object,
      required: true
    },
    measureData: {
      type: Array,
      required: true
    },
    // 仮配置ノートかどうか
    isPreAppend: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    getLeft(note) {
      // TAP, ロング, 区切り線
      if ([1, 2, 95].includes(note.type)) {
        return (note.lane - 1) * 60;
      }
      // フリック
      else if ([3, 4].includes(note.type)) {
        let _width = note.option[0] || 3;
        if (_width === -1) _width = 3;
        let _left = (note.lane - 1) * 60 + 30;
        let _offset = 0;
        if (note.option[1] && note.option[2]) {
          _offset = (note.option[1] / note.option[2]) * 60;
        }
        return _left - (_width / 2) * 60 + _offset;
      }
      // テクスチャ
      else if (note.type === 94) {
        let _width = note.option[1] || 1;
        let _left = (note.lane - 1) * 60 + 30;
        let _offset = 0;
        if (note.option[3] && note.option[4]) {
          _offset = (note.option[3] / note.option[4]) * 60;
        }
        return _left - (_width / 2) * 60 + _offset;
      }
      // LED制御
      else if (this.note.type === 96) {
        return -50;
      }
      // 音札, その他特殊ノーツ
      else {
        return 0;
      }
    },
    getAbsoluteLeft(note) {
      return this.getLeft(note) + 60;
    },
    getBottom(note) {
      const targetMeasure =
        this.measureData[note.measure] || this.measureData.last;
      return (note.position / note.split) * targetMeasure.measureHeight;
    },
    getAbsoluteBottom(note) {
      const targetMeasure = this.measureData[note.measure];
      if (targetMeasure) {
        return (
          targetMeasure.measurePositionBottom +
          (note.position / note.split) * targetMeasure.measureHeight
        );
      } else {
        const lastMeasure = this.measureData.last;
        const diff = note.measure - lastMeasure.measure;
        return (
          diff * lastMeasure.measureHeight +
          lastMeasure.measurePositionBottom +
          (note.position / note.split) * lastMeasure.measureHeight
        );
      }
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
      // テクスチャ
      else if (note.type === 94) {
        let _width = note.option[1] || 1;
        return 60 * _width;
      }
      // 区切り線
      else if (note.type === 95) {
        let _width = note.option[0] || 1;
        if (_width === -1) _width = 1;
        if (note.position === 0) _width = 5;
        return 60 * _width;
      }
      // LED制御
      else if (this.note.type === 96) {
        return 40;
      }
      // その他
      else return 300;
    },
    calcelThisNote() {
      if (this.isPreAppend) this.cancelNote(this.note.index);
    }
  },
  computed: {
    dispColor() {
      return this.note.type === 96
        ? `rgb(${this.note.option[0]},${this.note.option[1]},${this.note.option[2]})`
        : null;
    }
  }
};
</script>

<style lang="scss" scoped>
.shadow {
  color: #909090;
  animation: blink 0.5s infinite;
  &:active {
    transform: scale(1.5);
  }
}
.preappend {
  opacity: 1;
  color: rgba(255, 255, 255, 0.5) !important;
  transition: none;
  box-shadow: 0 0 4px 4px rgba(255, 255, 0, 0.25);
  cursor: pointer;
  &__index {
    display: block;
    color: limegreen;
    line-height: 10px;
  }
}
.type94 .preappend__index {
  position: absolute;
  right: 0;
  top: 0;
}

@keyframes blink {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 1;
  }
  51% {
    opacity: 0.5;
  }
  100% {
    opacity: 0.5;
  }
}
</style>
