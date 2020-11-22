<template>
  <div>
    <div
      class="preview"
      ref="preview"
      :style="{
        position: isPreviewing ? 'fixed' : 'relative',
        height: `${entireHeight}px`,
        marginBottom: `${lift}px`
      }"
      :class="{
        detail: isShowDetail,
        capture: isCaptureMode,
        checkbox: isShowCheckbox
      }"
    >
      <!-- 各小節 -->
      <Measure
        v-for="measure in measureData"
        :key="`measure_${measure.measure}`"
        :measure="measure"
        :notes="getMeasureNotes(measure.measure)"
        :currentDifficulty="currentDifficulty"
      />

      <!-- ロングノーツ -->
      <!-- FIXME: 多分負荷でかい -->
      <LongNote
        v-for="(note, i) in longNotes"
        :key="`longnote_${i}`"
        :note="note"
        :measureData="measureData"
      />

      <!-- 配置前のシャドー -->
      <NoteShadow
        v-if="appendNote"
        :note="appendNote"
        :measureData="measureData"
      />

      <!-- 仮配置ノーツ -->
      <NoteShadow
        v-for="(note, i) in preAppendNotes"
        :key="`shadow_${note.measure}_${i}`"
        :note="note"
        :measureData="measureData"
        :isPreAppend="true"
      />

      <!-- LED -->
      <div
        class="led left"
        :style="{
          background: ledColor
        }"
      ></div>
      <div
        class="led right"
        :style="{
          background: ledColor
        }"
      ></div>
    </div>

    <div class="control">
      <v-expansion-panels accordion>
        <v-expansion-panel>
          <v-expansion-panel-header>
            <v-btn
              class="mr-1"
              outlined
              color="success"
              @click.stop="previewStart"
              :disabled="isPreviewing"
            >
              <v-icon left>mdi-play</v-icon> 再生
            </v-btn>
            <v-btn
              class="ml-2 mr-2"
              outlined
              color="error"
              @click.stop="previewStop"
            >
              <v-icon left>mdi-stop</v-icon> 停止
            </v-btn>
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <v-checkbox
              class="mt-0"
              v-model="isPlayGuide"
              label="小節ガイド音を再生"
            ></v-checkbox>
            <v-checkbox
              class="mt-0"
              v-model="isPlayKeySound"
              label="打鍵音を再生(beta)"
            ></v-checkbox>
            <v-text-field
              class="mb-4"
              v-model.number="lift"
              hide-details
              label="LIFT"
              suffix="px"
              outlined
              dense
            ></v-text-field>
            <v-text-field
              class="mb-4"
              v-model.number="sudden"
              hide-details
              label="SUDDEN"
              suffix="px"
              outlined
              dense
            ></v-text-field>
            <v-text-field
              class="mb-4"
              v-model.number="hidden"
              hide-details
              label="HIDDEN"
              suffix="px"
              outlined
              dense
            ></v-text-field>
            <v-text-field
              v-model.number="startFrom"
              hide-details
              label="再生開始小節"
              suffix="小節から"
              outlined
              dense
            ></v-text-field>
          </v-expansion-panel-content>
        </v-expansion-panel>
      </v-expansion-panels>
    </div>

    <div
      class="lift"
      v-show="isPreviewing"
      :style="{
        height: `${lift}px`
      }"
    ></div>

    <div
      class="sudden"
      :style="{
        height: `${sudden}px`
      }"
    ></div>

    <div
      class="hidden"
      v-show="isPreviewing"
      :style="{
        height: `${hidden}px`,
        bottom: `${lift - 2}px`
      }"
    ></div>
  </div>
</template>

<script>
import Measure from "./Measure.vue";
import LongNote from "./LongNote.vue";
import NoteShadow from "./NoteShadow.vue";
import html2canvas from "html2canvas";

export default {
  props: {
    currentChart: {
      type: Array,
      default: () => []
    },
    currentDifficulty: {
      type: String,
      default: "easy"
    },
    measureData: {
      type: Array,
      default: () => []
    },
    previewAudio: {
      type: HTMLAudioElement
    },
    audioVolume: {
      type: Number,
      default: 100
    },
    infoObject: {
      type: Object,
      required: true
    },
    appendNote: {
      type: Object
    },
    preAppendNotes: {
      type: Array
    },
    isShowDetail: {
      type: Boolean,
      default: false
    },
    isShowCheckbox: {
      type: Boolean,
      default: false
    },
    isCaptureMode: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isPreviewing: false,
      returnPosition: -1, // 戻る座標
      currentPosition: 0,
      timeoutIds: [],
      intervalId: null, // 小節プレビューセット用
      startFrom: 0,
      currentMeasure: 0,
      currentBpm: 0,
      currentBeat: 0,
      isPlayGuide: false,
      soundIds: [],
      isPlayKeySound: false,
      guideAudio: new Audio("/chart-editor/guide.mp3"),
      ledColor: "linear-gradient(0deg, #ff5151 30%, #44a5ff 70%)",
      lift: localStorage.getItem("chart-editor__lift") || 0, // LIFTオプション
      sudden: localStorage.getItem("chart-editor__sudden") || 0, // SUDDENオプション
      hidden: localStorage.getItem("chart-editor__hidden") || 0 // HIDDENオプション
    };
  },
  watch: {
    lift: value => localStorage.setItem("chart-editor__lift", value),
    sudden: value => localStorage.setItem("chart-editor__sudden", value),
    hidden: value => localStorage.setItem("chart-editor__hidden", value)
  },
  methods: {
    screenshot() {
      html2canvas(document.querySelector(".preview"), {
        allowTaint: true
      }).then(canvas => {
        document.querySelector(".panel").appendChild(canvas);
      });
    },
    // 特定小節内のノーツを取得
    getMeasureNotes(measureNumber) {
      return this.currentChart.filter(note => note.measure === measureNumber);
    },
    playFromMeasure() {
      const startOffset = this.startOffset;

      const audioDelay =
        (60 / this.infoObject.bpm) * this.infoObject.beat * 1000;

      setTimeout(() => {
        this.previewAudio.volume = this.audioVolume / 100;
        this.previewAudio.currentTime = startOffset / 1000;
        this.previewAudio.play();
      }, audioDelay);

      // let index = 0;
      // let delay = this.previewDelay;
      // this.intervalId = setInterval(() => {
      //   const measure = this.measureData[index] || {};
      //   const next = this.measureData[index + 1] || {};

      //   if (measure.measureReachTime > startOffset) {
      //     this.timeoutIds.append(
      //       setTimeout(() => {
      //         this.currentMeasure = measure.measure;
      //         this.currentPosition = next.measurePositionBottom;
      //         this.currentBpm = measure.measureBpm;
      //         this.currentBeat = measure.measureBeat;
      //         const transitionTime =
      //           next.measureReachTime - measure.measureReachTime;
      //         this.$refs.preview.style.transition = `${transitionTime}ms all linear`;
      //         this.$refs.preview.style.bottom = `-${this.currentPosition}px`;
      //       }, measure.measureReachTime - index * 10 - startOffset)
      //     );
      //   }
      //   index++;
      //   delay -= 10;
      //   console.log(delay);
      //   if (index * 10 + 100 >= this.previewDelay)
      //     clearInterval(this.intervalId);
      // }, 10);

      this.measureData.forEach((measure, index) => {
        const next = this.measureData[index + 1] || {};
        if (measure.measureReachTime > startOffset) {
          this.timeoutIds.push(
            setTimeout(() => {
              this.currentPosition = next.measurePositionBottom;
              const transitionTime =
                next.measureReachTime - measure.measureReachTime;
              this.$refs.preview.style.transition = `${transitionTime}ms all linear`;
              this.$refs.preview.style.bottom = `-${this.currentPosition}px`;
              // 小節ガイド音再生
              if (this.isPlayGuide) {
                this.guideAudio.currentTime = 0;
                this.guideAudio.play();
              }
            }, measure.measureReachTime - startOffset)
          );
        }
      });
      if (this.isPlayKeySound) this.setKeySounds(startOffset);
    },
    playFromZero() {
      // 拍子木分オフセット
      setTimeout(() => {
        this.previewAudio.currentTime = 0;
        this.previewAudio.volume = this.audioVolume / 100;
        this.previewAudio.play();
      }, (60 / this.infoObject.bpm) * this.infoObject.beat * 1000);
      // 1小節ずつプレビュー
      const measureData = [...this.measureData];
      measureData.forEach((measure, index) => {
        const next = measureData[index + 1] || {};
        this.timeoutIds.append(
          setTimeout(() => {
            this.currentPosition = next.measurePositionBottom;
            const transitionTime =
              next.measureReachTime - measure.measureReachTime;
            this.$refs.preview.style.transition = `${transitionTime}ms all linear`;
            this.$refs.preview.style.bottom = `-${this.currentPosition}px`;
            // 小節ガイド音再生
            if (this.isPlayGuide) {
              this.guideAudio.currentTime = 0.1;
              this.guideAudio.play();
            }
          }, measure.measureReachTime)
        );
      });
      if (this.isPlayKeySound) this.setKeySounds(0);
    },
    // 打鍵音のTimeoutをセットする
    setKeySounds(offset) {
      this.keyTimings.each(timing => {
        const time = timing - offset;
        if (time > 0)
          this.soundIds.push(
            setTimeout(() => {
              const keySound = new Audio("/chart-editor/guide.mp3");
              keySound.currentTime = 0.1;
              keySound.play();
            }, time)
          );
      });
    },
    previewStart() {
      this.returnPosition = window.scrollY; // 停止後に戻る座標
      this.isPreviewing = true;
      this.$refs.preview.style.transition = "0ms all linear";
      // this.$refs.preview.style.bottom = "0px";
      // this.$refs.preview.style.transition = `${this.measureData.first.measureReachTime}ms all linear`;
      this.$refs.preview.style.bottom = `-${this.measureData.first.measurePositionBottom}px`;
      if (this.startFrom === 0) this.playFromZero();
      else this.playFromMeasure();
    },
    previewStop() {
      this.previewAudio.pause();
      this.isPreviewing = false;
      this.currentPosition = 0;
      this.currentBpm = 0;
      this.currentBeat = 0;
      this.$refs.preview.style.transition = "0ms all linear";
      this.$refs.preview.style.bottom = "0px";
      this.timeoutIds.each(id => clearInterval(id));
      this.timeoutIds = [];
      this.soundIds.each(id => clearInterval(id));
      this.soundIds = [];
      if (this.returnPosition >= 0) this.$vuetify.goTo(this.returnPosition);
      this.returnPosition = -1;
    }
  },
  computed: {
    // 全体からロングノーツだけを取得
    longNotes() {
      return this.currentChart.filter(note => note.type === 2);
    },
    keyTimings() {
      return this.isPlayKeySound
        ? this.currentChart.map(note => {
            if ([1, 2, 3, 4, 5].includes(note.type)) {
              const md = this.measureData[note.measure];
              return (
                md.measureReachTime +
                (note.position / note.split) * md.measureLength
              );
            } else return -1;
          }).uniq
        : [];
    },
    entireHeight() {
      return (
        this.measureData.last?.measurePositionBottom +
        this.measureData.last?.measureHeight
      );
    },
    startOffset() {
      return this.measureData[this.startFrom].measureReachTime;
    },
    previewDelay() {
      return this.measureData.size * 10 + 100;
    }
  },
  components: {
    Measure,
    LongNote,
    NoteShadow
  }
};
</script>

<style lang="scss" scoped>
.preview {
  background: #202020;
  width: 100%;
  width: 420px;
  right: 0;
  margin-left: calc(100% - 420px);
}
.control {
  position: fixed;
  top: 0;
  right: 420px;
  padding: 0;
  z-index: 111;
}
.led {
  position: fixed;
  top: 0;
  width: 20px;
  height: 100%;
  &.left {
    right: 400px;
  }
  &.right {
    right: 0;
  }
}
/* 各種オプション表示用 */
.lift {
  position: fixed;
  bottom: -2px;
  right: 20px;
  width: 380px;
  background: rgba(0, 0, 0, 0.6);
  z-index: 110;
  border-top: 2px solid #ff5151;
}
.sudden {
  position: fixed;
  top: 0;
  right: 20px;
  width: 380px;
  background: #505050;
  z-index: 110;
}
.hidden {
  position: fixed;
  right: 20px;
  width: 380px;
  background: #505050;
  z-index: 110;
}
</style>
