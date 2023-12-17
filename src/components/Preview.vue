<template>
  <div>
    <!-- プレビュー(オブジェクト表示) -->
    <div
      v-if="isObjectBasedPreview"
      class="object-based-preview"
      :style="{
        position: 'relative'
      }"
    >
      <!-- 各小節 -->
      <ObjectBasedMeasure
        v-for="measure in measureData"
        :key="`measure_${measure.measure}`"
        :measure="measure"
        :notes="getMeasureNotes(measure.measure)"
        :currentDifficulty="currentDifficulty"
      />
    </div>
    <!-- プレビュー(通常) -->
    <div
      v-else
      class="preview"
      ref="preview"
      :style="{
        position: isPreviewing ? 'fixed' : 'relative',
        height: `${entireHeight}px`,
        marginBottom: `${lift}px`,
        transform: drawOffset === 0 ? null : `translateY(${drawOffset}px)`
      }"
      :class="{
        detail: isShowDetail,
        capture_mode: isCaptureMode,
        preview_mode: isPreviewMode,
        image_mode: isImageMode,
        checkbox: isShowCheckbox
      }"
    >
      <!-- 各小節 -->
      <MeasureComponent
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
    </div>

    <!-- LED -->
    <div
      v-show="!isObjectBasedPreview && !isImageMode"
      class="led left"
      ref="LEDLeft"
    ></div>
    <div
      v-show="!isObjectBasedPreview && !isImageMode"
      class="led right"
      ref="LEDRight"
    ></div>

    <!-- LED(プレビュー時シャドー) -->
    <div
      v-if="!isObjectBasedPreview && isPreviewMode"
      class="led left -s"
      ref="LEDLeftShadow"
    ></div>
    <div
      v-if="!isObjectBasedPreview && isPreviewMode"
      class="led right -s"
      ref="LEDRightShadow"
    ></div>

    <div class="control">
      <v-expansion-panels accordionn tile>
        <v-expansion-panel>
          <v-expansion-panel-header>
            <v-btn
              class="mr-1"
              outlined
              color="success"
              @click.stop="previewStart"
              :disabled="isPreviewing || isObjectBasedPreview"
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
            <v-text-field
              class="mb-4"
              v-model.number="startFrom"
              hide-details
              prepend-icon="mdi-numeric-0-box-multiple-outline"
              label="再生開始小節"
              suffix="小節から"
              outlined
              dense
            ></v-text-field>

            <h4 class="my-2">
              <v-icon>mdi-music-note</v-icon>
              表示とサウンド
            </h4>
            <v-checkbox
              class="mt-2"
              v-model="isShowCheckbox"
              label="チェックボックスを表示"
              hide-details
            ></v-checkbox>
            <v-checkbox
              class="mt-2"
              v-model="isPlayKeySound"
              label="打鍵音を再生 (β)"
              hide-details
            ></v-checkbox>
            <v-checkbox
              class="mt-2"
              v-model="isPlayKeySoundEnd"
              label="LN終点音を再生 (α)"
              hide-details
            ></v-checkbox>
            <v-checkbox
              class="mt-2"
              v-model="isShowKeybeam"
              label="キービームとコンボを表示"
              persistent-hint
              hint="以下2つはこの機能が有効でない場合効果がありません"
            ></v-checkbox>
            <v-checkbox
              class="mt-2 ml-6"
              v-model="isShowFlickEffect"
              :disabled="!isShowKeybeam"
              label="フリックエフェクト (β)"
              hide-details
            ></v-checkbox>
            <v-checkbox
              class="mt-2 ml-6"
              v-model="isShowHandguide"
              :disabled="!isShowKeybeam"
              label="LeapMotion補助線をシミュレート (α)"
              hide-details
            ></v-checkbox>
            <v-checkbox
              class="mt-2"
              v-model="isSimulateLED"
              label="LED制御をシミュレート (β)"
              hide-details
            ></v-checkbox>
            <v-checkbox
              class="mt-2"
              v-model="isPlayGuide"
              label="小節ガイド音を再生"
              hide-details
            ></v-checkbox>

            <v-switch
              v-model="isObjectBasedPreview"
              label="Object表示モード"
            ></v-switch>

            <h4 class="my-4">
              <v-icon>mdi-tune</v-icon>
              再生オプション
            </h4>
            <v-text-field
              class="my-2"
              v-model.number="lift"
              hint="判定ラインを上に押し上げます"
              persistent-hint
              append-icon="mdi-arrow-collapse-up"
              label="LIFT"
              outlined
              dense
            ></v-text-field>
            <v-text-field
              class="mb-2"
              v-model.number="sudden"
              hint="譜面領域上部を隠します"
              persistent-hint
              append-icon="mdi-arrow-collapse-down"
              label="SUDDEN"
              outlined
              dense
            ></v-text-field>
            <v-text-field
              v-model.number="hidden"
              hint="譜面領域下部を隠します"
              persistent-hint
              append-icon="mdi-eye-off"
              label="HIDDEN"
              outlined
              dense
            ></v-text-field>

            <h4 class="my-4">
              <v-icon>mdi-tune</v-icon>
              詳細設定
            </h4>

            <v-text-field
              class="mb-2"
              v-model.number="comboOffset"
              hint="判定ラインの上側に移動します"
              persistent-hint
              append-icon="mdi-arrow-up"
              label="コンボ表示位置"
              outlined
              dense
            ></v-text-field>
            <v-text-field
              class="mb-2"
              v-model.number="drawOffset"
              hint="描画のみ位置をずらします"
              persistent-hint
              append-icon="mdi-arrow-expand-up"
              label="判定位置調整(β)"
              outlined
              dense
            ></v-text-field>
            <v-text-field
              v-model.number="keybeamLength"
              append-icon="mdi-arrow-expand-vertical"
              label="キービームの長さ"
              suffix="px"
              outlined
              hide-details
              dense
            ></v-text-field>
            <v-subheader>コンボ数の透明度</v-subheader>
            <v-slider
              v-model.number="comboOpacity"
              hide-details
              max="100"
              min="0"
              thumb-label="always"
            ></v-slider>
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
      v-show="isPreviewing"
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

    <div
      class="combo"
      v-show="isPreviewing && isShowKeybeam"
      :style="{
        opacity: String(Number(comboOpacity) / 100),
        bottom: `${Number(lift) + Number(comboOffset)}px`
      }"
    >
      <strong ref="currentCombo">0</strong>
      COMBO
    </div>

    <div
      class="keybeams"
      ref="keybeams"
      v-show="isShowKeybeam"
      :style="{
        bottom: `${lift - 2}px`,
        height: `${keybeamLength}px`
      }"
    >
      <div v-for="i in 6" :key="`keybeam${i}`"></div>
    </div>

    <div
      class="handguide"
      v-show="isPreviewing && isShowHandguide"
      ref="handguide"
      :style="{
        bottom: `${lift - 1}px`
      }"
    ></div>
  </div>
</template>

<script lang="ts">
import "buryjs";
import html2canvas from "html2canvas";
import Vue, { PropType } from "vue";
import {
  DifficultyString,
  ExtendedNoteData,
  Measure,
  PreviewEvent,
  PreviewEvents
} from "../types";

import MeasureComponent from "./Measure.vue";
import ObjectBasedMeasure from "./ObjectBasedMeasure.vue";
import LongNote from "./LongNote.vue";
import NoteShadow from "./NoteShadow.vue";

export default Vue.extend({
  name: "ThePreview",
  inject: ["showSnackbar"],
  props: {
    currentChart: {
      type: Array as PropType<ExtendedNoteData[]>,
      default: () => []
    },
    currentDifficulty: {
      type: String as PropType<DifficultyString>,
      default: "easy"
    },
    measureData: {
      type: Array as PropType<Measure[]>,
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
      type: Object as PropType<ExtendedNoteData>,
      required: false,
      default: null
    },
    preAppendNotes: {
      type: Array as PropType<ExtendedNoteData[]>,
      required: false,
      default: null
    },
    isShowDetail: {
      type: Boolean,
      default: false
    },
    isCaptureMode: {
      type: Boolean,
      default: false
    },
    isPreviewMode: {
      type: Boolean,
      default: false
    },
    isImageMode: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isPreviewing: false,
      returnPosition: -1, // 戻る座標
      currentPosition: 0,
      timeoutIds: new Array<number>(),
      intervalId: null, // 小節プレビューセット用
      startFrom: 0,
      currentMeasure: 0,
      currentBpm: 0,
      currentBeat: 0,
      currentCombo: 0, // プレビューするコンボ数
      isShowCheckbox: false,
      isShowKeybeam: false,
      isShowHandguide: false,
      isShowFlickEffect: false,
      isSimulateLED: false,
      isPlayGuide: false,
      eventIds: new Array<number>(),
      isPlayKeySound: false,
      isPlayKeySoundEnd: false,
      guideAudio: new Audio("/chart-editor/guide.mp3"),
      defaultLEDColor: "linear-gradient(0deg, #ff5151 30%, #44a5ff 70%)",
      lift: Number(localStorage.getItem("chart-editor__lift")) || 0, // LIFTオプション
      sudden: Number(localStorage.getItem("chart-editor__sudden")) || 0, // SUDDENオプション
      hidden: Number(localStorage.getItem("chart-editor__hidden")) || 0, // HIDDENオプション
      comboOffset: 60, // コンボ表示位置
      drawOffset: 0, // 描画オフセット
      keybeamLength: 100, // キービームの長さ
      comboOpacity: 50, // コンボ数の透明度
      isObjectBasedPreview: false // オブジェクト表示モード
    };
  },
  watch: {
    lift(value: number) { localStorage.setItem("chart-editor__lift", String(value)) },
    sudden(value: number) { localStorage.setItem("chart-editor__sudden", String(value)) },
    hidden(value: number) { localStorage.setItem("chart-editor__hidden", String(value)) }
  },
  methods: {
    screenshot() {
      html2canvas(document.querySelector(".preview")!, {
        allowTaint: true
      }).then(canvas => {
        document.querySelector(".panel")!.appendChild(canvas);
      });
    },
    // 特定小節内のノーツを取得
    getMeasureNotes(measureNumber: number) {
      return this.currentChart.filter(note => note.measure === measureNumber);
    },
    playFromMeasure() {
      const startOffset = this.startOffset;

      const audioDelay =
        (60 / this.infoObject.bpm) * this.infoObject.beat * 1000;

      setTimeout(() => {
        // eslint-disable-next-line vue/no-mutating-props
        this.previewAudio.volume = this.audioVolume / 100;
        // eslint-disable-next-line vue/no-mutating-props
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
          const diff = measure.measureLength === 0 ? -30 : 0;
          this.timeoutIds.push(
            setTimeout(() => {
              this.currentPosition = next.measurePositionBottom;
              const transitionTime =
                next.measureReachTime - measure.measureReachTime;
              const elem = this.$refs.preview as HTMLElement;
              // 瞬間移動の場合
              console.log('warp confirm', measure.measureLength);
              if (measure.measureLength === 0) {
                console.log('warp', this.currentPosition);
                elem.style.transition = 'none';
                elem.style.bottom = `-${this.currentPosition}px`;
                return;
              }
              elem.style.transition = `${transitionTime}ms all linear`;
              elem.style.bottom = `-${this.currentPosition}px`;
              // 小節ガイド音再生
              if (this.isPlayGuide) {
                this.guideAudio.currentTime = 0;
                this.guideAudio.play();
              }
            }, measure.measureReachTime - startOffset + diff)
          );
        }
      });
      this.setNoteEvents(startOffset);
    },
    playFromZero() {
      // 拍子木分オフセット
      setTimeout(() => {
        // eslint-disable-next-line vue/no-mutating-props
        this.previewAudio.currentTime = 0;
        // eslint-disable-next-line vue/no-mutating-props
        this.previewAudio.volume = this.audioVolume / 100;
        this.previewAudio.play();
      }, (60 / this.infoObject.bpm) * this.infoObject.beat * 1000);
      // 1小節ずつプレビュー
      const measureData = [...this.measureData];
      measureData.forEach((measure, index) => {
        const next = measureData[index + 1] || {};
        const diff = measure.measureLength === 0 ? -30 : 0;
        this.timeoutIds.append(
          setTimeout(() => {
            this.currentPosition = next.measurePositionBottom;
            const transitionTime =
              next.measureReachTime - measure.measureReachTime;
            const elem = this.$refs.preview as HTMLElement;
            elem.style.transition = `${transitionTime}ms all linear`;
            elem.style.bottom = `-${this.currentPosition}px`;
            // 小節ガイド音再生
            if (this.isPlayGuide) {
              this.guideAudio.currentTime = 0.1;
              this.guideAudio.play();
            }
          }, measure.measureReachTime + diff)
        );
      });
      this.setNoteEvents(0);
    },
    // NoteEvents(ノート到達時イベント)をセットする
    setNoteEvents(offset: number) {
      let prevMoveTiming = -500;
      let prevMoveTimer: number | null = null;
      const isShowFlickEffect = this.isShowFlickEffect;
      const isShowHandguide = this.isShowHandguide;
      Object.entries(this.previewEvents).forEach(([timing, event]: [string, PreviewEvent]) => {
        const time = Number(timing) - offset;
        const keybeamDOMs = (this.$refs.keybeams as HTMLElement).querySelectorAll("div");
        const comboDOM = this.$refs.currentCombo as HTMLElement;
        const handguideDOM = this.$refs.handguide as HTMLElement;
        if (time > 0) {
          this.eventIds.push(
            setTimeout(() => {
              // 打鍵音を再生
              if (event.sound && this.isPlayKeySound) {
                const keySound = new Audio("/chart-editor/guide.mp3");
                keySound.currentTime = 0.1;
                keySound.play();
              }
              // キービームを出す
              if (this.isShowKeybeam) {
                // 単押し
                event.lane.each((num: number) => {
                  keybeamDOMs[num].classList.add("-on");
                });
                setTimeout(() => {
                  event.lane.each((num: number) => {
                    keybeamDOMs[num].classList.remove("-on");
                  });
                }, 25);
                // LN(ホールド)
                event.hold.each(([num, delay]: [number, number]) => {
                  keybeamDOMs[num].classList.add("-hold");
                  this.eventIds.push(
                    setTimeout(() => {
                      keybeamDOMs[num].classList.remove("-hold");
                      // hold配列の分、終点時にコンボ増加
                      this.currentCombo += 1;
                      comboDOM.textContent = String(this.currentCombo);
                      // 終点音を再生
                      if (
                        event.sound &&
                        this.isPlayKeySound &&
                        this.isPlayKeySoundEnd
                      ) {
                        const keySound = new Audio("/chart-editor/guide.mp3");
                        keySound.currentTime = 0.1;
                        keySound.play();
                      }
                    }, delay)
                  );
                });
                // フリックエフェクト
                if (event.handMove && isShowFlickEffect && event.noteObject) {
                  const effectDOM = document.createElement("div");
                  effectDOM.classList.add("flick-effect", event.handMove);
                  (this.$refs.keybeams as HTMLElement).appendChild(effectDOM);
                  // 座標計算
                  const _left = (event.noteObject.lane - 1) * 60 + 30;
                  let _offset = 0;
                  let _width = Number(event.noteObject.option[0]) || 3;
                  if (event.noteObject.option[1] && event.noteObject.option[2])
                    _offset =
                      (Number(event.noteObject.option[1]) /
                        Number(event.noteObject.option[2])) *
                      60;
                  if (_width === -1) _width = 3;
                  effectDOM.style.left = `${_left -
                    (_width / 2) * 60 +
                    _offset}px`;
                  effectDOM.style.width = `${60 * _width}px`;
                  // 消えるタイマーのセット
                  setTimeout(() => {
                    (this.$refs.keybeams as HTMLElement).removeChild(effectDOM);
                  }, 250);
                }
                // コンボ数
                this.currentCombo += event.count;
                comboDOM.textContent = String(this.currentCombo);
              }
              // ハンドガイド(手の動き)をシミュレート
              if (isShowHandguide) {
                if (event.handMove) {
                  handguideDOM.classList.add(event.handMove);
                  if (prevMoveTimer && Number(timing) - prevMoveTiming > 200) {
                    clearTimeout(prevMoveTimer);
                  }
                  prevMoveTimer = setTimeout(() => {
                    handguideDOM.classList.remove(event.handMove as string);
                  }, 200);
                  prevMoveTiming = Number(timing);
                }
              }
              // LEDを指定色に変化
              if (this.isSimulateLED && event.color) {
                this.setLEDColor(event.color);
              }
            }, time)
          );
        } else {
          this.currentCombo += event.count + event.hold.size;
          if (this.isSimulateLED && event.color) this.setLEDColor(event.color);
        }
      });
    },
    previewStart() {
      if (!this.measureData[this.startFrom]) {
        // @ts-ignore "showSnackbar"
        this.showSnackbar(`${this.startFrom}小節はありません`);
        return false;
      }
      this.returnPosition = window.scrollY; // 停止後に戻る座標
      this.isPreviewing = true;
      this.currentCombo = 0;
      (this.$refs.currentCombo as HTMLElement).textContent = String(this.currentCombo);
      // this.$refs.preview.style.transition = `${this.measureData.first.measureReachTime}ms all linear`;
      (this.$refs.preview as HTMLElement).style.bottom = `-${this.measureData.first.measurePositionBottom}px`;
      (this.$refs.preview as HTMLElement).style.transition = "none";
      if (this.startFrom === 0) this.playFromZero();
      else this.playFromMeasure();
    },
    previewStop() {
      this.previewAudio.pause();
      this.isPreviewing = false;
      this.currentPosition = 0;
      this.currentBpm = 0;
      this.currentBeat = 0;
      this.currentCombo = 0;
      this.setLEDColor();
      (this.$refs.keybeams as HTMLElement)
        ?.querySelectorAll("div")
        .forEach(dom => dom.classList.remove("-hold"));
      (this.$refs.handguide as HTMLElement).classList.remove("-left", "-right");
      (this.$refs.preview as HTMLElement).style.transition = "0ms all linear";
      (this.$refs.preview as HTMLElement).style.bottom = "0px";
      this.timeoutIds.each((id: number) => clearInterval(id));
      this.timeoutIds = [];
      this.eventIds.each((id: number) => clearInterval(id));
      this.eventIds = [];
      if (this.returnPosition >= 0) {
        setTimeout(() => {
          window.scrollTo({ top: this.returnPosition, behavior: 'auto' });
          this.returnPosition = -1;
        }, 50);
      }
    },
    setLEDColor(color?: string) {
      (this.$refs.LEDLeft as HTMLElement).style.background = color || this.defaultLEDColor;
      (this.$refs.LEDRight as HTMLElement).style.background = color || this.defaultLEDColor;

      if (this.isPreviewMode) {
        (this.$refs.LEDLeftShadow as HTMLElement).style.background =
          color || this.defaultLEDColor;
        (this.$refs.LEDRightShadow as HTMLElement).style.background =
          color || this.defaultLEDColor;
      }
    }
  },
  computed: {
    // 全体からロングノーツ(＋ロングのダミー)だけを取得
    longNotes(): ExtendedNoteData[] {
      return this.currentChart.filter(note => {
        return note.type === 2 || (note.type === 90 && note.option[0] === "2")
      });
    },
    // ノートの到達イベント情報を生成
    previewEvents(): PreviewEvents {
      const events: PreviewEvents = {};
      if (this.isPlayKeySound || this.isShowKeybeam || this.isSimulateLED) {
        this.currentChart.each((note: ExtendedNoteData) => {
          const measure = this.measureData[note.measure];
          const timing =
            measure.measureReachTime +
            (note.position / note.split) * measure.measureLength;
          // タイミングをkeyにイベント情報をセット
          if (!events[timing] && [1, 2, 3, 4, 5, 96].includes(note.type))
            events[timing] = {
              timing, // 到達時間(ms)
              lane: [], // キービームを出すレーン番号
              hold: [], // キービームを出し続けるレーン番号
              holdEnd: [], // キービームを止めるレーン番号
              color: null, // LED変化の色
              count: 0, // 増加するコンボ数
              sound: false, // 再生するタップ音
              handMove: null, // 手の動き(LeapMotion)
              noteObject: null // ノートのオブジェクト(Type: 3, 4のみ)
            };
          // 通常
          if (note.type === 1) {
            events[timing].sound = true;
            events[timing].count += 1;
            events[timing].lane = events[timing].lane.append(note.lane).uniq;
          }
          // LN(始点と終点が同レーンの前提)
          else if (note.type === 2) {
            events[timing].sound = true;
            note.end.each((end: ExtendedNoteData) => {
              const endMeasure = this.measureData[end.measure];
              const endTiming =
                endMeasure.measureReachTime +
                (end.position / end.split) * endMeasure.measureLength;
              events[timing].hold = events[timing].hold.append([
                note.lane, // キービームをホールドするレーン
                endTiming - timing // ホールドする時間(ms)
              ]);
            });
          }
          // フリック
          else if (note.type === 3 || note.type === 4) {
            events[timing].sound = true;
            events[timing].count += 1;
            events[timing].noteObject = note;
            // 手の動き LeapMotion補助線
            if (note.type === 3) events[timing].handMove = "-left";
            else events[timing].handMove = "-right";
          }
          // 音札
          else if (note.type === 5) {
            events[timing].sound = true;
            events[timing].count += 1;
            events[timing].lane = events[timing].lane.append(0).uniq;
          }
          // LED制御
          else if (note.type === 96) {
            // (-1, -1, -1)の時はデフォルトに戻す
            if (
              Number(note.option[0]) === -1 &&
              Number(note.option[1]) === -1 &&
              Number(note.option[2]) === -1
            ) {
              events[timing].color = this.defaultLEDColor;
            } else
              events[
                timing
              ].color = `rgb(${note.option[0]},${note.option[1]},${note.option[2]})`;
          }
        });
      }
      return events;
    },
    entireHeight(): number {
      return (
        this.measureData.last?.measurePositionBottom +
        this.measureData.last?.measureHeight
      );
    },
    startOffset(): number {
      return this.measureData[this.startFrom].measureReachTime;
    },
    previewDelay(): number {
      return this.measureData.size * 10 + 100;
    }
  },
  components: {
    MeasureComponent,
    ObjectBasedMeasure,
    LongNote,
    NoteShadow
  }
});
</script>

<style lang="scss" scoped>
.preview {
  background: #202020;
  width: 100%;
  width: 420px;
  right: 0;
  margin-left: calc(100% - 420px);
}
.object-based-preview {
  bottom: unset !important;
}
.control {
  position: fixed;
  top: 0;
  right: 420px;
  padding: 0;
  z-index: 111;
  border-left: 2px solid #a0a0a0;
  border-bottom: 2px solid #a0a0a0;
  max-height: 100vh;
  overflow: scroll;
  scrollbar-width: thin;
}
.led {
  position: fixed;
  top: 0;
  width: 20px;
  height: 100vh;
  background: linear-gradient(0deg, #ff5151 30%, #44a5ff 70%);
  &.left {
    right: 400px;
  }
  &.right {
    right: 0;
  }
  &.-s {
    filter: blur(12px);
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
.combo {
  position: fixed;
  bottom: 50px;
  right: 20px;
  width: 380px;
  text-align: center;
  color: #f0f0f0;
  font-size: 20px;
  z-index: 112;
  > strong {
    display: block;
    font-size: 50px;
  }
}
.handguide {
  position: fixed;
  bottom: 0;
  right: 209px;
  width: 2px;
  height: 400px;
  text-align: center;
  background: #ffc2df;
  background: linear-gradient(0deg, #ffc2df88 0%, #ffc2df00 100%);
  opacity: 0.7;
  font-size: 20px;
  z-index: 111;
  transition: 0.2s all ease-out;
  &.-left {
    transform: skewX(4deg) translateX(-12vh);
    transition: 0.2s all ease-out;
  }
  &.-right {
    transform: skewX(-4deg) translateX(12vh);
    transition: 0.2s all ease-out;
  }
}
.keybeams {
  position: fixed;
  bottom: 0px;
  right: 60px;
  width: 300px;
  display: flex;
  > div {
    flex-grow: 1;
    opacity: 0;
    transition: 0.1s all linear;
    background: linear-gradient(#16d5f700 0%, #16d5f790 100%);
    &:first-child {
      position: absolute;
      top: 0;
      height: 100%;
      width: 300px;
      transition: 0.2s all linear;
      background: linear-gradient(#f7d51600 0%, #f7d51690 100%);
      transform-origin: bottom center;
      transform: scaleY(1.5);
      &.-on {
        transform: scaleY(1);
      }
    }
    &.-on {
      opacity: 1;
      transition: none;
    }
    &.-hold {
      opacity: 1;
      transition: none;
    }
  }
}
</style>
