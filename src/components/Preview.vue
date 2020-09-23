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
      <Measure
        v-for="measure in measureData"
        :key="measure.measure"
        :measure="measure"
        :notes="currentChart.filter(note => note.measure === measure.measure)"
      />

      <LongNote
        v-for="(note, i) in currentChart.filter(note => note.type === 2)"
        :key="i"
        :note="note"
        :measureData="measureData"
      />
    </div>
    <div class="control">
      <v-expansion-panels accordion>
        <v-expansion-panel>
          <v-expansion-panel-header />
          <v-expansion-panel-content>
            <v-btn class="mr-1" outlined color="success" @click="previewStart">
              <v-icon left>mdi-play</v-icon> 再生
            </v-btn>
            <v-btn class="ml-1" outlined color="error" @click="previewStop">
              <v-icon left>mdi-stop</v-icon> 停止
            </v-btn>
          </v-expansion-panel-content>
        </v-expansion-panel>
      </v-expansion-panels>
    </div>
  </div>
</template>

<script>
import Measure from "./Measure.vue";
import LongNote from "./LongNote.vue";

export default {
  data() {
    return {
      isPreviewing: false,
      currentPosition: 0,
      timeoutIds: []
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
    },
    previewAudio: {
      type: HTMLAudioElement
    },
    infoObject: {
      type: Object,
      required: true
    }
  },
  methods: {
    playFromMeasure(measure = 0) {
      measure;

      setTimeout(() => {
        this.previewAudio.currentTime = 0;
        this.previewAudio.play();
      }, (60 / this.infoObject.bpm) * this.infoObject.beat * 1000);

      this.measureData.forEach((measure, index) => {
        const next = this.measureData[index + 1] || {};
        this.timeoutIds.append(
          setTimeout(() => {
            this.currentPosition = next.measurePositionBottom;
            const transitionTime =
              next.measureReachTime - measure.measureReachTime;
            this.$refs.preview.style.transition = `${transitionTime}ms all linear`;
            this.$refs.preview.style.bottom = `-${this.currentPosition}px`;
          }, measure.measureReachTime)
        );
      });
    },
    previewStart() {
      this.isPreviewing = true;
      this.$refs.preview.style.transition = "0ms all linear";
      this.$refs.preview.style.bottom = "0px";

      this.$refs.preview.style.transition = `${this.measureData.first.measureReachTime}ms all linear`;
      this.$refs.preview.style.bottom = `-${this.measureData.first.measurePositionBottom}px`;
      this.playFromMeasure();
    },
    previewStop() {
      this.previewAudio.pause();
      this.isPreviewing = false;
      this.currentPosition = 0;
      this.$refs.preview.style.bottom = "0px";
      this.timeoutIds.forEach(id => clearInterval(id));
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
    Measure,
    LongNote
  }
};
</script>

<style lang="scss" scoped>
.preview {
  background: #202020;
  width: 100%;
  width: 380px;
  right: 0;
  margin-left: calc(100% - 380px);
}
.control {
  position: fixed;
  top: 0;
  right: 0;
  padding: 16px;
}
</style>
