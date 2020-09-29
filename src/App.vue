<template>
  <v-app id="app">
    <Preview
      :currentChart="currentChart"
      :infoObject="chartObject.info"
      :measureData="measureData"
      :previewAudio="previewAudio"
      :appendNote="getAppendNote"
    />

    <v-container fluid class="panel">
      <h3>譜面ファイル</h3>

      <v-row align="center">
        <v-file-input
          accept=".json, application/json"
          label="ファイルを選択"
          hide-details
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
            hide-details
            outlined
            dense
          ></v-select>
        </v-col>
      </v-row>

      <h3>ノートの挿入</h3>

      <v-checkbox v-model="isAppendMode" label="ノート挿入モード"></v-checkbox>

      <div v-if="isAppendMode">
        <v-row>
          <v-col cols="12" sm="3">
            <v-select
              :items="noteTypes"
              hide-details
              label="ノート種別"
              v-model="appendNote.type"
              outlined
              dense
            ></v-select>
          </v-col>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="appendNote.measure"
              label="measure"
              outlined
              dense
              hide-details
              type="number"
              min="0"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="appendNote.position"
              label="position"
              outlined
              dense
              hide-details
              type="number"
              min="0"
              :max="appendNote.split - 1"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="appendNote.split"
              label="split"
              outlined
              dense
              hide-details
              type="number"
              min="0"
            ></v-text-field>
          </v-col>
        </v-row>

        <div
          v-for="(opt, i) in noteOptions(appendNote)"
          :key="`option_${i}`"
          class="mb-4"
        >
          <v-text-field
            v-model="appendNote.option[i]"
            hide-details
            :label="opt.label"
            :type="opt.type"
            append-outer-icon="mdi-help"
            outlined
            dense
            @click:append-outer="scrollTo"
          ></v-text-field>
        </div>

        <v-row align="center" justify="space-between">
          <v-radio-group
            v-model="appendNote.lane"
            row
            prepend-icon="mdi-view-column-outline"
          >
            <v-radio v-for="n in 5" :key="n" :value="n"></v-radio>
          </v-radio-group>
          <v-btn
            class="ml-1"
            color="primary"
            @click="appendNotes([appendNote])"
          >
            ノートを挿入
            <v-icon right>mdi-keyboard-return</v-icon>
          </v-btn>
        </v-row>
      </div>

      <h3>プレビュー設定</h3>
      <v-slider
        v-model="beatHeight"
        min="20"
        max="300"
        append-icon="mdi-magnify-plus-outline"
        prepend-icon="mdi-magnify-minus-outline"
        @click:append="zoomIn"
        @click:prepend="zoomOut"
        step="10"
        thumb-label
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

      <v-row align="center" class="mb-8">
        <v-text-field
          v-model.number="scrollTo"
          suffix="小節へ"
          outlined
          dense
          hide-details
        ></v-text-field>
        <v-btn class="ml-4" color="primary" @click="scrollToMeasure(scrollTo)">
          <v-icon left>mdi-arrow-right</v-icon> 遷移
        </v-btn>
      </v-row>

      <h3>譜面情報</h3>
      <v-row align="center">
        <v-col>
          <v-text-field
            v-model.number="chartObject.info.offset"
            label="オフセット"
            required
            outlined
            dense
          ></v-text-field>
        </v-col>
        <v-col>
          <v-text-field
            v-model.number="chartObject.info.bpm"
            label="BPM"
            required
            outlined
            dense
          ></v-text-field>
        </v-col>
        <v-col>
          <v-text-field
            v-model.number="chartObject.info.beat"
            label="拍子"
            required
            outlined
            dense
          ></v-text-field>
        </v-col>
      </v-row>
      <v-row>
        <v-btn class="ml-1" color="success" @click="saveFile">
          <v-icon left>mdi-content-save</v-icon> 名前をつけて保存
        </v-btn>
      </v-row>
    </v-container>
  </v-app>
</template>

<script>
import Bury from "buryjs";
import Preview from "./components/Preview.vue";
import noteTypes from "./mixins/noteTypes";

export default {
  name: "App",
  mixins: [noteTypes],
  data() {
    return {
      isLoaded: false,
      reader: new FileReader(),
      previewAudio: new Audio(),
      fileName: "default-song.json",
      difficulties: ["raku", "easy", "normal", "hard", "extra"],
      currentDifficulty: "easy",
      chartObject: {
        raku: [],
        easy: [],
        normal: [],
        hard: [],
        extra: [],
        info: {
          offset: 0,
          bpm: 120,
          beat: 4
        }
      },
      appendNote: {
        type: 1,
        lane: 1,
        measure: 1,
        position: 0,
        split: 4,
        option: []
      },
      isAppendMode: true,
      scrollTo: 0,

      beatHeight: 100
    };
  },
  beforeCreate: Bury.init,
  mounted() {
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
    newFile() {
      this.fileName = "default.json";
      this.isLoaded = true;
    },
    saveFile() {
      const saveObject = this.chartObject;
      // TODO: Validationとオプション類の整形
      const blob = new Blob([JSON.stringify(saveObject, null, 4)], {
        type: "application/json"
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = this.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    readAudioFile(e) {
      this.previewAudio.src = window.URL.createObjectURL(e);
    },
    zoomOut() {
      this.beatHeight = this.beatHeight - 10 || 0;
    },
    zoomIn() {
      this.beatHeight = this.beatHeight + 10 || 100;
    },
    scrollToMeasure(measureNumber) {
      const measurePositionTop =
        this.measureData.last?.measurePositionBottom -
        this.measureData[measureNumber].measurePositionBottom;
      this.$vuetify.goTo(measurePositionTop);
    },
    appendNotes(notesArray) {
      notesArray.forEach(note => {
        this.chartObject[this.currentDifficulty]?.append({ ...note });
      });
    }
  },
  computed: {
    // 選択中の難易度の譜面データ配列
    currentChart() {
      return this.chartObject[this.currentDifficulty] || [];
    },
    musicBpm() {
      return this.chartObject.info.bpm;
    },
    musicBeat() {
      return this.chartObject.info.beat;
    },
    musicOffset() {
      return this.chartObject.info.offset;
    },
    maxMeasure() {
      return this.currentChart.size > 0
        ? this.currentChart.max_by(n => n.measure).measure
        : 1;
    },
    measureData() {
      const measureData = [];
      let measureBeat = this.musicBeat;
      let measureBpm = this.musicBpm;
      let measureReachTime = this.musicOffset;
      let measurePositionBottom =
        (this.musicOffset / ((60 / measureBpm) * 1000)) * this.beatHeight;
      (this.maxMeasure + 1).times(measure => {
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
    },
    getAppendNote() {
      return this.isAppendMode ? this.appendNote : null;
    }
  },
  components: {
    Preview
  }
};
</script>

<style lang="scss">
#app {
  font-family: "Open Sans", "Noto Sans JP", Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #333333;
  .panel {
    position: fixed;
    background: #f0f0f0;
    top: 0;
    left: 0;
    width: calc(100% - 380px);
    min-height: 100vh;
    padding: 12px 32px;
    h3 {
      margin: 8px -12px;
    }
  }
}
</style>
