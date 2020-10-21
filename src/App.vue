<template>
  <v-app id="app">
    <Preview
      :currentChart="currentChart"
      :infoObject="chartObject.info"
      :measureData="measureData"
      :previewAudio="previewAudio"
      :appendNote="getAppendNote"
      :preAppendNotes="preAppendNotes"
      :isShowDetail="isShowDetail"
      :isShowCheckbox="isShowCheckbox"
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

      <div v-show="isAppendMode">
        <v-checkbox
          v-model="isAutoFollow"
          label="編集小節を自動追従"
          class="mt-0"
        ></v-checkbox>
        <v-row>
          <v-col cols="12" sm="3">
            <v-select
              :items="noteTypes"
              hide-details
              label="ノート種別"
              @change="changeAppendNoteType"
              v-model="appendNote.type"
              outlined
              dense
            ></v-select>
          </v-col>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model.number="appendNote.measure"
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
              v-model.number="appendNote.position"
              label="position"
              outlined
              dense
              hide-details
              min="0"
              :max="appendNote.split - 1"
              background-color="#f0f0b0"
              @keydown.enter="placeNotes(appendNote)"
              @keydown.left="appendNoteToLeft"
              @keydown.right="appendNoteToRight"
              @keydown.up="appendNoteToUp"
              @keydown.down="appendNoteToDown"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="3">
            <v-combobox
              v-model.number="appendNote.split"
              :items="[4, 8, 16, 32, 12, 24, 48]"
              label="split"
              outlined
              hide-details
              dense
            ></v-combobox>
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
          <div>
            <v-btn
              class="ml-1 white--text"
              color="green darken-1"
              @click="placeNotes(appendNote)"
            >
              ノートを仮配置
              <v-icon right>mdi-keyboard-return</v-icon>
            </v-btn>
            <v-btn
              class="ml-4 white--text"
              color="orange darken-4"
              @click="appendNotes(...preAppendNotes)"
            >
              挿入する
              <v-icon right>mdi-plus-circle-outline</v-icon>
            </v-btn>
          </div>
        </v-row>

        <div class="my-4" v-show="appendNote.type === 2">
          <v-row align="center" justify="space-between">
            <h4>ロングノーツ編集</h4>
            <v-btn
              class="white--text"
              color="green darken-1"
              @click="addEndToAppendNote"
            >
              終点を追加
            </v-btn>
          </v-row>

          <EndForm
            v-for="(end, i) in appendNote.end"
            :key="`append_end_${i}`"
            :end="end"
            :parent="appendNote"
            :index="i"
            @delete-end="deleteEndOfAppendNote"
            @append-to-left="appendNoteToLeft"
            @append-to-right="appendNoteToRight"
            @append-to-up="appendNoteToUp"
            @append-to-down="appendNoteToDown"
            @place-notes="placeNotes(appendNote)"
          >
          </EndForm>
        </div>
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

      <v-row align="center">
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

      <v-row align="center">
        <v-checkbox
          v-model="isShowDetail"
          label="ノーツ詳細を表示"
        ></v-checkbox>
        <v-checkbox
          class="ml-4"
          v-model="isShowCheckbox"
          label="チェックボックスを表示"
        ></v-checkbox>
      </v-row>

      <h3>選択ノーツ</h3>

      <v-row align="center">
        <v-btn color="primary" text @click="selectionClear">
          <v-icon left>mdi-select-off</v-icon>
          すべて選択解除
        </v-btn>

        <v-dialog v-model="dialog.selectionDelete" width="500">
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              color="error"
              text
              @click="dialog.selectionDelete = true"
              v-bind="attrs"
              v-on="on"
            >
              <v-icon left>mdi-delete-forever</v-icon>
              選択ノーツを削除
            </v-btn>
          </template>
          <v-card>
            <v-card-title class="headline">確認</v-card-title>
            <v-card-text>
              本当に選択したノーツをすべて削除しますか？
            </v-card-text>
            <v-divider></v-divider>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn
                color="primary"
                text
                @click="dialog.selectionDelete = false"
              >
                キャンセル
              </v-btn>
              <v-btn color="error" text @click="selectionDelete">
                削除する
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
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
        <v-btn class="ml-1 mb-8" color="success" @click="saveFile">
          <v-icon left>mdi-content-save</v-icon> 名前をつけて保存
        </v-btn>
      </v-row>
    </v-container>

    <v-snackbar v-model="snackbar" vertical>
      {{ snackbarText }}
      <template v-slot:action="{ attrs }">
        <v-btn color="error" text v-bind="attrs" @click="snackbar = false">
          閉じる
        </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script>
import Bury from "buryjs";
import Preview from "./components/Preview.vue";
import EndForm from "./components/EndForm.vue";

import noteTypes from "./mixins/noteTypes";
import noteCheck from "./mixins/noteCheck";

export default {
  name: "App",
  mixins: [noteTypes, noteCheck],
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
      dialog: {
        selectionDelete: false
      },
      // 配置するノート
      appendNote: {
        type: 1,
        lane: 1,
        measure: 1,
        position: 0,
        split: 8,
        option: [],
        end: []
      },
      preAppendNotes: [], // 保管する配置ノーツ
      isAppendMode: true,
      isAutoFollow: true,
      scrollTo: 0,
      isShowDetail: false,
      isShowCheckbox: false,

      snackbar: false, // 通知表示管理
      snackbarText: "メッセージ", // 通知内容

      beatHeight: 100 // 一拍あたりの高さ(px)
    };
  },
  beforeCreate: Bury.init,
  mounted() {
    this.reader.onload = event => {
      this.chartObject = JSON.parse(event.target.result);
      this.difficulties.each(d => {
        this.chartObject[d] = this.chartObject[d].map((note, index) => {
          // 編集用の情報を付加
          return {
            ...note,
            index,
            isSelected: false
          };
        });
      });
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
      const saveObject = {
        raku: [],
        easy: [],
        normal: [],
        hard: [],
        extra: [],
        info: { ...this.chartObject.info }
      };
      // TODO: Validationとオプション類の整形
      // type: 5 は lane: 3
      // type: 96, 97, 98, 99は lane: -1
      // type: 2 以外は end: []
      // + optionキーのvalidation
      this.difficulties.each(d => {
        saveObject[d] = this.chartObject[d].map(note => {
          return {
            type: Number(note.type),
            measure: Number(note.measure),
            lane: Number(note.lane),
            position: Number(note.position),
            split: Number(note.split),
            option: [...note.option],
            end: note.end
          };
        });
      });
      console.log("saveObject", saveObject);
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
    // ノーツを挿入
    appendNotes(...notes) {
      notes.each(note => {
        const dup = this.isDuplicated(note, {
          checkPreAppend: false
        });
        if (dup) {
          this.showSnackbar(
            `${dup}個のノーツと重複しているため、挿入できないノーツがあります`
          );
          return false;
        }
        this.currentChart?.append({
          isSelected: false,
          ...JSON.parse(JSON.stringify(note)), // FIXME: deep-copyしたい
          index: this.currentChart.size
        });
      });
      this.preAppendNotes = [];
    },
    // ノーツを仮配置
    placeNotes(...notes) {
      notes.each(note => {
        const dup = this.isDuplicated(note);
        if (dup) {
          this.showSnackbar(
            `${dup}個のノーツと重複しているため、配置はキャンセルされました`
          );
          return false;
        }
        this.preAppendNotes.append({
          isSelected: false,
          index: this.preAppendNotes.size,
          ...JSON.parse(JSON.stringify(note)) // FIXME: deep-copyしたい
        });
      });
    },
    // appendNoteに終点を追加
    addEndToAppendNote() {
      this.appendNote.end.append({
        type: 1,
        lane: this.appendNote.lane,
        measure: this.appendNote.measure,
        position: Math.min(this.appendNote.position + 1, this.appendNote.split),
        split: this.appendNote.split,
        option: [],
        end: []
      });
    },
    // appendNoteから終点を削除
    deleteEndOfAppendNote(index) {
      this.appendNote.end.delete_at(index);
    },
    // ノーツ種別変更時に終点を制御
    changeAppendNoteType() {
      if (this.appendNote.type === 2) this.addEndToAppendNote();
      else this.appendNote.end = [];
    },
    appendNoteToLeft() {
      this.appendNote.lane = Math.max(this.appendNote.lane - 1, 1);
    },
    appendNoteToRight() {
      this.appendNote.lane = Math.min(this.appendNote.lane + 1, 5);
    },
    appendNoteToUp() {
      const note = this.appendNote;
      if (note.split - 1 <= note.position) {
        note.measure++;
        note.position = 0;
        // 小節切替時に自動追従
        if (this.isAutoFollow && this.measureData[note.measure])
          this.scrollToMeasure(note.measure);
      } else note.position++;
    },
    appendNoteToDown() {
      const note = this.appendNote;
      if (note.position === 0) {
        note.measure--;
        note.position = note.split - 1;
        // 小節切替時に自動追従
        if (this.isAutoFollow) this.scrollToMeasure(note.measure);
      } else note.position--;
    },
    deleteNote(index) {
      this.chartObject[this.currentDifficulty] = this.currentChart?.delete_if(
        note => note.index === index
      );
    },
    cancelNote(index) {
      this.preAppendNotes = this.preAppendNotes?.delete_if(
        note => note.index === index
      );
    },
    // すべて選択解除
    selectionClear() {
      this.chartObject[this.currentDifficulty] = this.currentChart?.map(
        note => {
          return {
            ...note,
            isSelected: false
          };
        }
      );
    },
    // 選択ノーツを削除
    selectionDelete() {
      this.chartObject[this.currentDifficulty] = this.currentChart?.delete_if(
        note => note.isSelected
      );
      this.dialog.selectionDelete = false;
    },
    // 通知を表示
    showSnackbar(message) {
      this.snackbar = false;
      this.snackbarText = message;
      setTimeout(() => (this.snackbar = true), 100);
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
    Preview,
    EndForm
  }
};
</script>

<style lang="scss">
#app {
  font-family: "Open Sans", "Noto Sans JP", Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #333333;
  background: #202020;
  .panel {
    position: fixed;
    background: #f0f0f0;
    top: 0;
    left: 0;
    width: calc(100% - 420px);
    height: 100vh;
    overflow-y: auto;
    padding: 12px 32px;
    h3 {
      margin: 8px -12px;
    }
  }
  .v-menu__content {
    z-index: 111 !important;
  }
}
.note {
  position: absolute;
  z-index: 100;
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
  input[type="checkbox"] {
    position: absolute;
    right: 0;
    top: -20px;
    display: none;
  }
  &.menu {
    box-shadow: 0 0 4px 4px rgba(125, 255, 125, 0.5);
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
    z-index: 99;
    height: 6px;
    background: #87cefa;
    z-index: 1;
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
    z-index: 99;
    height: 6px;
    background: #f08080;
    z-index: 1;
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
    z-index: 98;
    height: 1px;
    background: #a0a0a0;
    &.hidden {
      background: transparent;
    }
  }
  &.type97 {
    z-index: 98;
    height: 1px;
    background: greenyellow;
  }
  &.type98 {
    z-index: 98;
    height: 1px;
    background: yellow;
  }
  &.type99 {
    z-index: 98;
    height: 0;
    border-top: 2px dashed #ff5050;
  }
}
.preview.detail .note {
  color: #f0f0f0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
.preview.checkbox .note input[type="checkbox"] {
  display: block;
}

.note-hold {
  position: absolute;
  background: #ffffec;
  opacity: 0.9;
  width: 38px;
  margin: 0 11px;
  border-left: 4px solid #6ecc6e;
  border-right: 4px solid #6ecc6e;
  transition: 0.1s all ease;
}
</style>
