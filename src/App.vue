<template>
  <v-app id="app">
    <Preview
      :currentChart="currentChart"
      :infoObject="chartObject.info"
      :measureData="measureData"
      :previewAudio="previewAudio"
    />

    <v-container fluid class="panel">
      <v-row align="center">
        <v-file-input
          accept=".json, application/json"
          label="ファイルを選択"
          outlined
          dense
          prepend-icon="mdi-folder"
          @change="readFile"
        ></v-file-input>
        <v-col>
          <v-select
            :items="difficulties"
            label="難易度"
            v-model="currentDifficulty"
            align="left"
            outlined
            dense
          ></v-select>
        </v-col>
      </v-row>
      <v-slider
        v-model="beatHeight"
        min="50"
        max="200"
        append-icon="mdi-magnify-plus-outline"
        prepend-icon="mdi-magnify-minus-outline"
        @click:append="zoomIn"
        @click:prepend="zoomOut"
      ></v-slider>
      <v-row align="center">
        <v-file-input
          accept="audio/*"
          label="楽曲ファイル選択"
          outlined
          dense
          prepend-icon="mdi-music"
          @change="readAudioFile"
        ></v-file-input>
      </v-row>
      <v-row align="center">
        <v-text-field
          v-model.number="chartObject.info.offset"
          label="オフセット"
          required
        ></v-text-field>
      </v-row>
    </v-container>
  </v-app>
</template>

<script>
import Bury from "buryjs";
import Preview from "./components/Preview.vue";

export default {
  name: "App",
  data() {
    return {
      isLoaded: false,
      reader: new FileReader(),
      previewAudio: new Audio(),
      fileName: "default-song.json",
      difficulties: ["raku", "easy", "normal", "hard", "extra"],
      currentDifficulty: "easy",
      chartObject: {
        info: {}
      },

      beatHeight: 100
    };
  },
  mounted() {
    Bury.init();
    this.reader.onload = event => {
      this.chartObject = JSON.parse(event.target.result);
      this.isLoaded = true;
    };
  },
  methods: {
    readFile(e) {
      this.fileName = e.name;
      this.reader.readAsText(e);
    },
    readAudioFile(e) {
      this.previewAudio.src = window.URL.createObjectURL(e);
    },
    zoomOut() {
      this.beatHeight = this.beatHeight - 10 || 0;
    },
    zoomIn() {
      this.beatHeight = this.beatHeight + 10 || 100;
    }
  },
  computed: {
    // 選択中の難易度の譜面データ配列
    currentChart() {
      return this.isLoaded ? this.chartObject[this.currentDifficulty] : null;
    },
    musicBpm() {
      return this.isLoaded ? this.chartObject.info.bpm : null;
    },
    musicBeat() {
      return this.isLoaded ? this.chartObject.info.beat : null;
    },
    musicOffset() {
      return this.isLoaded ? this.chartObject.info.offset : null;
    },
    maxMeasure() {
      return this.isLoaded
        ? this.currentChart.max_by(n => n.measure).measure
        : 1;
    },
    measureData() {
      if (!this.isLoaded) return [];
      const measureData = [];
      let measureBeat = this.musicBeat;
      let measureBpm = this.musicBpm;
      let measureReachTime = this.musicOffset;
      let measurePositionBottom =
        (this.musicOffset / ((60 / measureBpm) * 1000)) * this.beatHeight;
      this.maxMeasure.times(measure => {
        // type 97, 98 をfindして求める
        let beatChangeNote = this.currentChart.find(
          n => n.type === 97 && n.measure === measure
        );
        let bpmChangeNote = this.currentChart.find(
          n => n.type === 98 && n.measure === measure
        );
        if (beatChangeNote) measureBeat = beatChangeNote.option[0];
        if (bpmChangeNote) measureBpm = bpmChangeNote.option[0];
        let measureHeight = this.beatHeight * measureBeat;
        measureData.push({
          measure,
          measureBpm,
          measureBeat,
          measureReachTime,
          measurePositionBottom,
          measureHeight
        });
        measureReachTime += (60 / measureBpm) * measureBeat * 1000;
        measurePositionBottom += this.beatHeight * measureBeat;
      });
      return measureData;
    }
  },
  components: {
    Preview
  }
};
</script>

<style lang="scss">
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #333333;
  .panel {
    position: fixed;
    background: #f0f0f0;
    top: 0;
    left: 0;
    width: calc(100% - 380px);
    min-height: 100vh;
  }
}
</style>
