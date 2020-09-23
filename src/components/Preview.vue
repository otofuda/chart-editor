<template>
  <div>
    <div
      class="preview"
      ref="preview"
      :style="{
        position: isPreviewing ? 'fixed' : 'relative',
        height: `${entireHeight}px`
      }"
    >
      <div
        v-for="measure in measureData"
        :key="measure.measure"
        :style="{
          bottom: `${measure.measurePositionBottom}px`,
          height: `${measure.measureHeight}px`
        }"
        class="preview__measure"
      >
        {{ measure.measure }}
        <Note
          v-for="(note, i) in currentChart.filter(
            note => note.measure === measure.measure
          )"
          :key="i"
          :note="note"
          :measure="measure"
        />
      </div>
    </div>
    <div class="control">
      <button @click="previewStart">再生</button>
      <button @click="previewStop">停止</button>
    </div>
  </div>
</template>

<script>
import Note from "./Note.vue";

export default {
  data() {
    return {
      isPreviewing: false,
      currentPosition: 0
    };
  },
  props: {
    currentChart: {
      type: Array,
      default: () => []
    },
    measureData: {
      type: Array,
      default: () => []
    }
  },
  methods: {
    previewStart() {
      this.isPreviewing = true;
      this.$refs.preview.style.transition = "0ms all linear";
      this.$refs.preview.style.bottom = "0px";

      setTimeout(() => {
        this.$refs.preview.style.transition = `${this.measureData.first.measureReachTime}ms all linear`;
        this.$refs.preview.style.bottom = `-${this.measureData.first.measurePositionBottom}px`;
      }, 1);

      this.measureData.forEach((measure, index) => {
        const next = this.measureData[index + 1] || {};
        setTimeout(() => {
          this.currentPosition = next.measurePositionBottom;
          const transitionTime =
            next.measureReachTime - measure.measureReachTime;
          this.$refs.preview.style.transition = `${transitionTime}ms all linear`;
          this.$refs.preview.style.bottom = `-${this.currentPosition}px`;
        }, measure.measureReachTime);
      });
    },
    previewStop() {
      this.isPreviewing = false;
      this.currentPosition = 0;
    }
  },
  computed: {
    entireHeight() {
      return (
        this.measureData.last?.measurePositionBottom +
        this.measureData.last?.measureHeight
      );
    }
  },
  components: {
    Note
  }
};
</script>

<style lang="scss" scoped>
.preview {
  background: #202020;
  width: 100%;
  right: 0;
  &__measure {
    width: 300px;
    background: linear-gradient(
      to left,
      transparent 19.75%,
      #606060 20%,
      transparent 20.25%,
      transparent 39.75%,
      #606060 40%,
      transparent 40.25%,
      transparent 59.75%,
      #606060 60%,
      transparent 60.25%,
      transparent 79.75%,
      #606060 80%,
      transparent 80.75%
    );
    box-shadow: inset 0 -1px 0 0 white;
    color: #ffffff;
    position: absolute;
    right: 40px;
  }
}
.control {
  position: fixed;
  top: 0;
  right: 0;
}
</style>
