<template>
  <v-app id="app">
    <Preview
      :currentChart="currentChart"
      :currentDifficulty="currentDifficulty"
      :infoObject="chartObject.info"
      :measureData="measureData"
      :audioVolume="audioVolume"
      :previewAudio="previewAudio"
      :appendNote="getAppendNote"
      :preAppendNotes="preAppendNotes"
      :isShowDetail="isShowDetail"
      :isCaptureMode="isCaptureMode"
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
        <v-row justify="space-between">
          <v-checkbox
            v-model="isAutoFollow"
            label="編集小節を自動追従"
            class="mt-0 ml-3"
          ></v-checkbox>
          <v-btn
            class="ml-4 white--text"
            color="orange darken-4"
            text
            @click="appendSimultaneously(appendNote)"
          >
            このノートのみを全難易度に同時挿入
            <v-icon right>mdi-plus-circle</v-icon>
          </v-btn>
        </v-row>
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
            @click:append-outer="
              showSnackbar(`${opt.label}の説明：${opt.desc}`)
            "
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
        :thumb-size="24"
        thumb-label="always"
        min="20"
        max="300"
        append-icon="mdi-magnify-plus-outline"
        prepend-icon="mdi-magnify-minus-outline"
        @click:append="zoomIn"
        @click:prepend="zoomOut"
        step="10"
      ></v-slider>

      <v-row align="center">
        <v-col cols="12" sm="6">
          <v-file-input
            accept="audio/*"
            label="楽曲ファイル選択"
            outlined
            dense
            prepend-icon="mdi-music"
            @change="readAudioFile"
          ></v-file-input>
        </v-col>
        <v-col cols="12" sm="6">
          <v-slider
            v-model="audioVolume"
            :thumb-size="24"
            thumb-label="always"
            min="0"
            max="100"
            prepend-icon="mdi-volume-high"
            step="5"
          ></v-slider>
        </v-col>
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
        <v-checkbox
          class="ml-4"
          v-model="isCaptureMode"
          label="キャプチャ用モード"
        ></v-checkbox>
      </v-row>

      <h3>選択ノーツ（{{ selectionNumber }}個）</h3>

      <v-row align="center">
        <v-btn color="primary" text @click="dialog.batchcheck = true">
          <v-icon left>mdi-checkbox-marked-circle-outline</v-icon>
          ノーツの一括選択
        </v-btn>

        <v-btn color="warning" text @click="selectionClear">
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
              本当に選択したノーツ{{ selectionNumber }}個をすべて削除しますか？
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

        <v-btn color="primary" text @click="dialog.checked = true">
          <v-icon left>mdi-auto-fix</v-icon>
          ノーツの一括操作
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
        <v-btn
          class="ml-1 mb-8"
          color="primary"
          @click="dialog.help = true"
          text
        >
          <v-icon left>mdi-help-circle</v-icon> 使い方
        </v-btn>
        <v-btn
          class="ml-1 mb-8"
          color="primary"
          @click="dialog.logs = true"
          text
        >
          <v-icon left>mdi-message-outline</v-icon> メッセージログ
        </v-btn>
        <v-btn class="ml-1 mb-8" color="primary" @click="analyze" text>
          <v-icon left>mdi-chart-timeline-variant</v-icon> 譜面分析
        </v-btn>
        <v-btn class="ml-1 mb-8" color="success" @click="saveFile">
          <v-icon left>mdi-content-save</v-icon> 名前をつけて保存
        </v-btn>
      </v-row>

      <v-card v-if="dialog.logs" class="mx-auto message-log" elevation="8">
        <v-card-title>
          <v-btn icon class="mr-4" @click="dialog.logs = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
          メッセージログ
        </v-card-title>
        <v-virtual-scroll
          :bench="0"
          :items="logs.slice().reverse()"
          height="300"
          item-height="64"
        >
          <template v-slot:default="{ item }">
            <v-list-item :key="item" v-text="item" class="my-2" />
            <v-divider></v-divider>
          </template>
        </v-virtual-scroll>
      </v-card>
    </v-container>

    <v-dialog v-model="dialog.help" width="800">
      <v-card>
        <v-card-title class="headline">
          エディタの使い方
        </v-card-title>
        <v-card-text>
          <a target="_blank" rel="noopener noreferrer">
            エディタの使い方
          </a>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="dialog.analyzer" width="800">
      <v-card>
        <v-card-title class="headline">
          譜面分析 ({{ currentDifficulty }})
        </v-card-title>
        <v-card-text>
          ノーツ数：{{ analysisData.notesCount }}
          <br />
          オブジェクト数：{{ currentChart.size }}
          <br />
          平均密度：{{
            (analysisData.notesCount / measureData.last.measureReachTime) *
              1000
          }}Notes / 秒
        </v-card-text>
        <v-divider></v-divider>
        <v-sparkline
          v-if="dialog.analyzer"
          :labels="analysisData.trendLabels"
          :value="analysisData.trendValues"
          :gradient="['#f72047', '#ffd200', '#1feaea']"
          color="black"
          line-width="2"
          padding="10"
          smooth="3"
        ></v-sparkline>
        <v-sparkline
          v-if="dialog.analyzer"
          :value="analysisData.otofudaNotes"
          color="orange"
          line-width="2"
          height="10"
          padding="0"
          smooth="0"
          fill
        ></v-sparkline>
        <v-card-text class="mt-4">
          ▲音札ノーツの位置
        </v-card-text>
        <v-simple-table>
          <thead>
            <tr>
              <th class="text-left">
                種類別ノーツ数
              </th>
              <th class="text-left">
                数
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="type in noteTypes" :key="`note_count_${type.value}`">
              <td>{{ type.text }}</td>
              <td>{{ analysisData.typeCount[type.value] }}</td>
            </tr>
          </tbody>
        </v-simple-table>
      </v-card>
    </v-dialog>

    <v-dialog v-model="dialog.checked" width="800">
      <v-card>
        <v-card-title>
          <v-icon left>mdi-auto-fix</v-icon>
          選択ノーツへの一括操作
          <v-spacer></v-spacer>
          <v-btn icon @click="dialog.checked = false" right>
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider></v-divider>
        <v-card-title>
          種別の変更
        </v-card-title>
        <v-card-text>
          <p>
            選択したノーツ(ロングノーツと音札ノーツを除く)を特定の種別に一括で変更します。
          </p>
          <v-row align="center" class="mx-1">
            <v-text-field
              type="number"
              v-model.number="selectionTypeTo"
              min="1"
              max="99"
              prefix="Type:"
              outlined
              dense
              hide-details
            ></v-text-field>
            <v-btn
              class="ml-4"
              color="primary"
              @click="selectionChangeType(selectionTypeTo)"
            >
              <v-icon left>mdi-auto-fix</v-icon> 選択ノーツを全て種別変更
            </v-btn>
          </v-row>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-title>
          レーンの変更
        </v-card-title>
        <v-card-text>
          <p>
            選択したノーツ(ロングノーツと音札ノーツを除く)を特定のレーンに一括で移動します。(選択範囲、または対象レーンに対して)同時押しを含む範囲に対して実行すると重複が発生します。
          </p>
          <v-row align="center" class="mx-1">
            <v-text-field
              type="number"
              v-model.number="selectionLaneTo"
              min="1"
              max="5"
              prefix="Lane:"
              outlined
              dense
              hide-details
            ></v-text-field>
            <v-btn
              class="ml-4"
              color="primary"
              @click="selectionChangeLane(selectionLaneTo)"
            >
              <v-icon left>mdi-auto-fix</v-icon> 選択ノーツを全てレーン移動
            </v-btn>
          </v-row>
        </v-card-text>
        <v-card-text>
          <p>
            選択したノーツ(ロングノーツと音札ノーツを除く)のそれぞれのレーンを1～5の範囲内で加算または減算します。入力は「－4」～「＋4」の範囲。
          </p>
          <v-row align="center" class="mx-1">
            <v-text-field
              type="number"
              v-model.number="selectionLaneAddition"
              min="-4"
              max="4"
              prefix="値:"
              outlined
              dense
              hide-details
            ></v-text-field>
            <v-btn
              class="ml-4"
              color="primary"
              @click="selectionAddLane(selectionLaneAddition)"
            >
              <v-icon left>mdi-auto-fix</v-icon>
              各選択ノーツのレーンを加算または減算
            </v-btn>
          </v-row>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="dialog.batchcheck" width="800">
      <v-card>
        <v-card-title>
          <v-icon left>mdi-checkbox-marked-circle-outline</v-icon>
          ノーツの一括選択
          <v-spacer></v-spacer>
          <v-btn icon @click="dialog.batchcheck = false" right>
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider></v-divider>
        <v-card-title>
          対象Type
        </v-card-title>
        <v-card-text>
          <p>
            対象Typeに合致するノーツを選択対象に加えます。
            <a @click="batchSelectTypes = noteTypes.map(t => t.value)">
              すべて選択
            </a>
            ・
            <a @click="batchSelectTypes = []">すべて解除</a>
          </p>
          <v-checkbox
            class="d-inline-block mr-4"
            v-for="type in noteTypes"
            v-model="batchSelectTypes"
            :label="type.text"
            :value="type.value"
            :key="`batch-select-type_${type.value}`"
            hide-details
          ></v-checkbox>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-title>
          対象小節
        </v-card-title>
        <v-card-text>
          <p>
            対象小節の範囲内のノーツを選択対象に加えます。終了小節を0にすると譜面の最後までを対象とします。
          </p>
          <v-row align="center" class="mx-1">
            <v-text-field
              class="mr-4"
              v-model.number="batchSelectStart"
              type="number"
              min="0"
              prefix="開始："
              suffix="小節"
              outlined
              dense
              hide-details
            ></v-text-field>
            <v-text-field
              v-model.number="batchSelectEnd"
              type="number"
              min="0"
              prefix="終了："
              suffix="小節"
              outlined
              dense
              hide-details
            ></v-text-field>
          </v-row>
        </v-card-text>
        <v-card-text>
          <p>予測される選択個数：{{ batchSelectTarget.size }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="batchSelect">
            <v-icon left>mdi-checkbox-marked-circle-outline</v-icon>
            すべて選択する
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
      audioVolume: 100,
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
        selectionDelete: false, // 選択ノーツ削除確認
        analyzer: false, // 譜面分析
        help: false, // 使い方
        logs: false, // メッセージログ
        checked: false, // 選択ノーツへの操作
        batchcheck: false // ノーツの一括選択
      },
      analysisData: {
        notesCount: 0,
        trendValues: [],
        trendLabels: [],
        otofudaNotes: [],
        typeCount: {}
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
      isCaptureMode: false,

      // 一括選択の対象
      batchSelectTypes: [],
      batchSelectStart: 0,
      batchSelectEnd: 0,

      // 選択ノーツへの操作
      selectionLaneTo: 1,
      selectionLaneAddition: 1,
      selectionTypeTo: 1,

      snackbar: false, // 通知表示管理
      snackbarText: "メッセージ", // 通知内容
      logs: [], // メッセージログ

      // 一拍あたりの高さ(px)
      beatHeight: localStorage.getItem("chart-editor__beat-height") || 100
    };
  },
  // 依存性注入(DI)
  provide() {
    return {
      showSnackbar: this.showSnackbar,
      deleteNotes: this.deleteNotes,
      cancelNote: this.cancelNote,
      appendNotes: this.appendNotes,
      getMovedNote: this.getMovedNote,
      copyNotesToDifficulty: this.copyNotesToDifficulty
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
    window.addEventListener("beforeunload", e => {
      e.preventDefault();
      e.returnValue = "移動してもよろしいですか？";
    });
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
      // TODO: Validation
      // type: 5 は lane: 3
      // type: 96, 97, 98, 99は lane: -1
      // type: 2 以外は end: []
      this.difficulties.each(d => {
        saveObject[d] = this.chartObject[d].map(note => {
          return {
            type: Number(note.type),
            measure: Number(note.measure),
            lane: Number(note.lane),
            position: Number(note.position),
            split: Number(note.split),
            option: this.getValidatedOptions(note),
            end: note.end || []
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
            `${dup}個のノーツと重複しているため、挿入できないノーツがありました`
          );
          return false;
        }
        // 配置ノートのindexは、currentChart内の最大index+1
        const index =
          this.currentChart.size === 0
            ? 1
            : this.currentChart.max_by(n => n.index).index + 1;
        this.currentChart?.append({
          isSelected: false,
          ...JSON.parse(JSON.stringify(note)), // FIXME: deep-copyしたい
          index,
          option: this.getValidatedOptions(note)
        });
      });
      this.showSnackbar(`${notes.size}個のノートの挿入を試行しました`);
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
        // 仮配置のindexは、preAppendNotes内の最大index+1
        const index =
          this.preAppendNotes.size === 0
            ? 1
            : this.preAppendNotes.max_by(n => n.index).index + 1;
        this.preAppendNotes.append({
          isSelected: false,
          index,
          ...JSON.parse(JSON.stringify(note)), // FIXME: deep-copyしたい
          option: this.getValidatedOptions(note)
        });
      });
    },
    // ノーツを全ての難易度に同時挿入
    appendSimultaneously(...notes) {
      notes.each(note => {
        let difficultyCount = 0;
        // 各難易度に対して重複検査＋append
        this.difficulties.each(difficulty => {
          const dup = this.isDuplicated(note, {
            comparators: this.chartObject[difficulty]
          });
          if (dup) {
            this.showSnackbar(
              `${dup}個のノーツと重複しているため、挿入できないノーツがあります`
            );
            return false;
          }
          this.chartObject[difficulty]?.append({
            isSelected: false,
            ...JSON.parse(JSON.stringify(note)), // FIXME: deep-copyしたい
            index: this.chartObject[difficulty].size
          });
          difficultyCount++;
        });
        this.showSnackbar(`ノートを${difficultyCount}難易度に同時挿入しました`);
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

      if (this.appendNote.type === 94)
        this.appendNote.option = [
          "https://via.placeholder.com/50x100",
          1,
          0.25
        ];
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
    deleteNotes(...index) {
      index.each(i => {
        this.chartObject[this.currentDifficulty] = this.currentChart?.delete_if(
          note => note.index === i
        );
      });
    },
    cancelNote(index) {
      this.preAppendNotes = this.preAppendNotes?.delete_if(
        note => note.index === index
      );
    },
    // 対象難易度とノーツオブジェクトからノーツを複製 (現在の難易度=>対象難易度)
    copyNotesToDifficulty(
      targetDifficulty = this.currentDifficulty,
      ...targets
    ) {
      const currentDifficulty = this.currentDifficulty;
      this.currentDifficulty = targetDifficulty;
      this.appendNotes(...targets);
      this.currentDifficulty = currentDifficulty;
    },
    // oldNoteがnewMeasure小節に移動した時のノートオブジェクトを返す
    getMovedNote(oldNote, newMeasure) {
      const diff = newMeasure - oldNote.measure;
      return {
        ...oldNote,
        measure: newMeasure,
        end: oldNote.end.map(end => {
          this.getMovedNote({ ...end }, newMeasure + diff);
        })
      };
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
      const num = this.selectionNumber;
      this.chartObject[this.currentDifficulty] = this.currentChart?.delete_if(
        note => note.isSelected
      );
      this.dialog.selectionDelete = false;
      this.showSnackbar(`${num}個のノーツを削除しました`);
    },
    // 選択ノーツのTypeを変更
    selectionChangeType(type) {
      const t = Number(type);
      if ([2, 5, 94].includes(t)) {
        this.showSnackbar(`Typeを${t}に一括変更することはできません`);
        return false;
      }
      const targets = this.chartObject[this.currentDifficulty].filter(
        note => note.isSelected && ![2, 5].includes(note.type)
      );
      if (targets.size === 0) {
        this.showSnackbar("対象ノーツがありません(Type一括変更)");
        return false;
      }
      targets.each(note => (note.type = t));
      this.showSnackbar(`Type:${t}への一括変更を実行しました`);
      this.dialog.checked = false;
    },
    // 選択ノーツのレーンを変更
    selectionChangeLane(lane) {
      const l = Number(lane);
      const targets = this.chartObject[this.currentDifficulty].filter(
        note => note.isSelected && ![2, 5].includes(note.type)
      );
      if (targets.size === 0) {
        this.showSnackbar("対象ノーツがありません(Lane一括変更)");
        return false;
      }
      targets.each(note => (note.lane = l));
      this.showSnackbar(`Lane:${l}への一括変更を実行しました`);
      this.dialog.checked = false;
    },
    // 選択ノーツのレーンを加算または減算
    selectionAddLane(diff) {
      const d = Number(diff);
      const targets = this.chartObject[this.currentDifficulty].filter(
        note => note.isSelected && ![2, 5].includes(note.type)
      );
      if (targets.size === 0) {
        this.showSnackbar("対象ノーツがありません(Lane一括加算)");
        return false;
      }
      if (d < 0) {
        targets.each(note => (note.lane = Math.max(note.lane + d, 1)));
        this.showSnackbar(`${d} 一括減算処理を実行しました`);
      } else {
        targets.each(note => (note.lane = Math.min(note.lane + d, 5)));
        this.showSnackbar(`+${d} 一括加算処理を実行しました`);
      }
      this.dialog.checked = false;
    },
    // 対象ノーツを一括選択
    batchSelect() {
      const num = this.batchSelectTarget.size;
      this.batchSelectTarget.each(target => (target.isSelected = true));
      this.dialog.batchcheck = false;
      this.showSnackbar(`${num}個のノーツを一括選択しました`);
    },
    // 通知を表示
    showSnackbar(message) {
      this.snackbar = false;
      this.snackbarText = message;
      setTimeout(() => (this.snackbar = true), 100);
      this.logs.append(`通知バー：${message}`);
    },
    // 譜面分析
    analyze() {
      // 分析データを初期化
      this.analysisData.trendLabels = [];
      this.analysisData.trendValues = [];
      this.analysisData.otofudaNotes = [];
      this.analysisData.notesCount = 0;
      this.noteTypes.each(type => {
        this.analysisData.typeCount[type.value] = 0;
      });
      // ラベルとデータ配列を初期化
      this.measureData.each(m => {
        if (m.measure % 10 === 0)
          this.analysisData.trendLabels.append(String(m.measure));
        else this.analysisData.trendLabels.append(" ");
        this.analysisData.trendValues.append(0);
        this.analysisData.otofudaNotes.append(0);
      });
      // 分析
      this.currentChart.each(note => {
        if ([1, 2, 3, 4, 5].includes(note.type)) {
          this.analysisData.trendValues[note.measure] += 1;
          this.analysisData.notesCount += 1;
        }
        if (note.type === 5) this.analysisData.otofudaNotes[note.measure] += 1;
        this.analysisData.typeCount[note.type] += 1;
      });
      this.dialog.analyzer = true;
    }
  },
  // localStorageにコンフィグを書き込む
  watch: {
    beatHeight: value =>
      localStorage.setItem("chart-editor__beat-height", value)
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
      // 小節データを生成
      (this.maxMeasure + 1).times(measure => {
        // type 97, 98 をfindして求める
        const beatChangeNote = this.currentChart.find(
          n => n.type === 97 && n.measure === measure
        );
        const bpmChangeNote = this.currentChart.find(
          n => n.type === 98 && n.measure === measure
        );
        if (beatChangeNote) measureBeat = beatChangeNote.option[0];
        if (bpmChangeNote) measureBpm = bpmChangeNote.option[0];
        const measureHeight = this.beatHeight * measureBeat;
        const measureLength = (60 / measureBpm) * measureBeat * 1000;
        measureData.push({
          measure,
          measureBpm,
          measureBeat,
          measureReachTime,
          measurePositionBottom,
          measureHeight,
          measureLength
        });
        measureReachTime += measureLength;
        measurePositionBottom += this.beatHeight * measureBeat;
      });
      return measureData;
    },
    // 一括選択の対象ノーツ
    batchSelectTarget() {
      const min = this.batchSelectStart;
      const max = this.batchSelectEnd === 0 ? Infinity : this.batchSelectEnd;
      return this.currentChart.filter(
        note =>
          this.batchSelectTypes.includes(note.type) &&
          note.measure >= min &&
          note.measure <= max
      );
    },
    // 選択中のノーツ個数
    selectionNumber() {
      return this.currentChart.filter(note => note.isSelected).size;
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
  > img {
    width: 100%;
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
  &.type94 {
    z-index: 1;
    height: auto;
    background: transparent;
    line-height: 0;
    > i {
      position: absolute;
    }
    &:hover {
      background: rgba(255, 255, 255, 0.25);
    }
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
.preview.detail.capture {
  .note {
    color: #a0a0a0;
  }
  .note.type94,
  .note.type95 {
    color: transparent;
    text-shadow: none;
  }
}

.note-hold {
  position: absolute;
  z-index: 98;
  background: #ffffec;
  opacity: 0.9;
  width: 38px;
  margin: 0 11px;
  border-left: 4px solid #6ecc6e;
  border-right: 4px solid #6ecc6e;
  transition: 0.1s all ease;
}

.message-log {
  position: fixed;
  top: 20px;
  left: 20px;
  width: 400px;
}
</style>
