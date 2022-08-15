<!-- eslint-disable vue/no-mutating-props -->
<template>
  <v-menu
    v-model="menu"
    :close-on-click="false"
    :close-on-content-click="false"
    absolute
    left
    :nudge-left="50"
    :max-width="240"
  >
    <template v-slot:activator="{ on, attrs }">
      <!-- 音符を描画 -->
      <span
        class="note"
        :class="{
          [`type${drawType}`]: true,
          isDummy: note.type === 91,
          hidden: isHiddenControl,
          menu
        }"
        :style="{
          left: `${positionLeft}px`,
          bottom: `${positionBottom}px`,
          width: `${noteWidth}px`,
          background: dispColor
        }"
        v-bind="attrs"
        v-on="on"
      >
        <!-- テクスチャの時 -->
        <img
          v-if="drawType === 94"
          :src="drawOptions"
          :style="{
            height: `${measure.measureHeight * Number(drawOptions[2])}px`
          }"
          alt="texture"
        />

        <!-- コメントの時 -->
        <v-icon v-if="drawType === 100" color="warning" class="mt-2">
          mdi-comment
        </v-icon>
        <v-textarea
          outlined
          background-color="amber lighten-4"
          v-if="drawType === 100"
          v-model="note.option[0]"
          class="elevation-4"
          hide-details
          @click.stop
        ></v-textarea>

        <input
          type="checkbox"
          v-model="note.isSelected"
          :id="note.index"
          @click.stop
        />

        <v-tooltip v-if="getDuplicated" bottom>
          <template v-slot:activator="{ on, attrs }">
            <v-icon color="warning" dark v-bind="attrs" v-on="on" class="mt-2">
              mdi-alert
            </v-icon>
          </template>
          <span>{{ getDuplicated }}個の重複</span>
        </v-tooltip>

        <v-tooltip v-if="getError" bottom>
          <template v-slot:activator="{ on, attrs }">
            <v-icon color="error" dark v-bind="attrs" v-on="on" class="mt-2">
              mdi-alert-circle-outline
            </v-icon>
          </template>
          <span>{{ getError }}</span>
        </v-tooltip>

        <strong v-if="drawType === 97">BEAT {{ note.option[0] }}</strong>
        {{ note.position }}/{{ note.split }}
        <strong v-if="drawType === 92">STOP</strong>
        <strong v-if="drawType === 93">WARP {{ note.option[0] }}</strong>
        <strong v-if="drawType === 98">BPM {{ note.option[0] }}</strong>
        <strong v-if="drawType === 99">EOF</strong>
      </span>
    </template>

    <!-- ポップアップ編集 -->
    <v-card v-if="menu" rounded="lg">
      <v-list>
        <v-list-item>
          <v-card-text>#{{ note.index }} {{ noteTypeName }}</v-card-text>
          <v-spacer></v-spacer>
          <v-btn icon @click="menu = false" right>
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-list-item>

        <v-list-item>
          <v-row>
            <v-col>
              <v-text-field
                :value="note.measure"
                @change="value => (note.measure = Number(value))"
                @keydown.enter.stop="menu = false"
                hide-details
                suffix="小節"
                outlined
                dense
              ></v-text-field>
            </v-col>
          </v-row>
        </v-list-item>

        <v-list-item>
          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="note.position"
                label="position"
                outlined
                dense
                hide-details
                type="number"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="note.split"
                label="split"
                outlined
                dense
                hide-details
                type="number"
              ></v-text-field>
            </v-col>
          </v-row>
        </v-list-item>

        <v-list-item>
          LANE
          <v-spacer></v-spacer>
          <v-radio-group
            v-model.number="note.lane"
            row
            :disabled="getIsLanelessNote"
          >
            <v-radio v-for="n in 5" :key="n" :value="n"></v-radio>
          </v-radio-group>
        </v-list-item>

        <v-list-item>
          <v-select
            :items="getNoteTypes"
            hide-details
            label="ノート種別"
            v-model="note.type"
            align="left"
            outlined
            dense
            :menu-props="{ rounded: 'lg' }"
          ></v-select>
        </v-list-item>

        <v-list-item v-if="getOptions.length > 0">
          <v-card-text>オプション</v-card-text>
          <v-spacer></v-spacer>
          <v-btn
            href="https://github.com/otofuda/chart-types"
            target="_blank"
            icon
            right
          >
            <v-icon>mdi-help</v-icon>
          </v-btn>
        </v-list-item>

        <v-list-item v-for="(opt, i) in getOptions" :key="`option_${i}`">
          <v-text-field
            v-model="note.option[i]"
            hide-details
            :label="opt.label"
            :type="opt.type"
            outlined
            dense
          ></v-text-field>
        </v-list-item>
      </v-list>

      <v-card-actions>
        <v-btn color="primary" text @click="cloneThisNote">
          <v-icon>mdi-content-copy</v-icon>
        </v-btn>
        <v-btn color="error" text @click="deleteThisNote">
          <v-icon left>mdi-delete</v-icon>
          削除
        </v-btn>
        <v-btn color="secondary" text @click="showNoteInfo">
          <v-icon>mdi-information</v-icon>
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script lang="ts">
import Vue, { PropType } from "vue";
import { ExtendedNoteData, Measure } from "@/types";

import noteTypes, { NoteTypesOption } from "@/mixins/noteTypes";
import noteCheck from "@/mixins/noteCheck";

export default Vue.extend({
  name: "NoteComponent",
  mixins: [noteTypes, noteCheck],
  inject: ["deleteNotes", "setAppendNoteInfo", "showSnackbar"],
  // @ts-ignore noteTypes と noteCheck は mixins で定義
  data() {
    return {
      menu: false
    };
  },
  props: {
    note: {
      type: Object as PropType<ExtendedNoteData>,
      required: true
    },
    measure: {
      type: Object as PropType<Measure>,
      required: true
    },
    // 重複判定に使用
    currentChart: {
      type: Array as PropType<ExtendedNoteData[]>,
      required: true
    }
  },
  // @ts-ignore noteOptions は mixins で定義
  methods: {
    deleteThisNote() {
      // @ts-ignore "deleteNotes" inject
      this.deleteNotes(this.note.index);
      this.menu = false;
    },
    cloneThisNote() {
      // @ts-ignore "setAppendNoteInfo" inject
      this.setAppendNoteInfo({
        ...this.note,
        option: [...this.note.option],
        end: []
      });
      this.menu = false;
      // @ts-ignore "showSnackbar" inject
      this.showSnackbar("挿入ノートに同じデータをセットしました");
    },
    showNoteInfo() {
      // @ts-ignore "showSnackbar" inject
      this.showSnackbar(JSON.stringify(this.note, null, 2));
    }
  },
  computed: {
    positionLeft(): number {
      // TAP, ロング, 区切り線, コメント
      if ([1, 2, 95, 100].includes(this.drawType)) {
        return (this.note.lane - 1) * 60;
      }
      // フリック
      else if ([3, 4].includes(this.drawType)) {
        let _width = Number(this.drawOptions[0]) || 3;
        if (_width === -1) _width = 3;
        let _left = (this.note.lane - 1) * 60 + 30;
        let _offset = 0;
        const numer = Number(this.drawOptions[1]),
          denom = Number(this.drawOptions[2]);
        if (numer && denom) {
          _offset = (numer / denom) * 60;
        }
        return _left - (_width / 2) * 60 + _offset;
      }
      // テクスチャ
      else if (this.drawType === 94) {
        let _width = Number(this.drawOptions[1]) || 1;
        let _left = (this.note.lane - 1) * 60 + 30;
        let _offset = 0;
        if (this.drawOptions[3] && this.drawOptions[4]) {
          _offset = (Number(this.drawOptions[3]) / Number(this.drawOptions[4])) * 60;
        }
        return _left - (_width / 2) * 60 + _offset;
      }
      // LED制御
      else if (this.drawType === 96) {
        return -50;
      }
      // 音札, その他特殊ノーツ
      else {
        return 0;
      }
    },
    positionBottom(): number {
      return (
        (this.note.position / this.note.split) * this.measure.measureHeight
      );
    },
    noteWidth(): number {
      // TAP, ロング, コメント
      if ([1, 2, 100].includes(this.drawType)) return 60;
      // 左右フリック
      else if ([3, 4].includes(this.drawType)) {
        let _width = Number(this.drawOptions[0]) || 3;
        if (_width === -1) _width = 3;
        return 60 * _width;
      }
      // テクスチャ
      else if (this.drawType === 94) {
        let _width = Number(this.drawOptions[1]) || 1;
        return 60 * _width - 1;
      }
      // 区切り線
      else if (this.drawType === 95) {
        let _width = Number(this.drawOptions[0]) || 1;
        if (_width === -1) _width = 1;
        if (this.note.position === 0) _width = 5;
        return 60 * _width;
      }
      // LED制御
      else if (this.drawType === 96) {
        return 40;
      }
      // その他
      else return 300;
    },
    isHiddenControl(): boolean {
      return this.drawType === 95 && this.note.position === 0;
    },
    noteTypeName(): string {
      // @ts-ignore "noteTypes" mixin
      return this.noteTypes.find(t => t.value === this.note.type)?.text;
    },
    dispColor(): string | null {
      if (this.drawType === 96) {
        if (
          Number(this.drawOptions[0]) === -1 &&
          Number(this.drawOptions[1]) === -1 &&
          Number(this.drawOptions[2]) === -1
        ) {
          return "linear-gradient(0deg, #ff5151 20%, #44a5ff 80%)";
        } else
          return `rgb(${this.drawOptions[0]},${this.drawOptions[1]},${this.drawOptions[2]})`;
      }
      return null;
    },
    /** 描画用のノートタイプ(ダミー時は擬態対象) */
    drawType (): number {
      if (this.note.type === 91) {
        return Number(this.note.option[0]);
      }
      return this.note.type;
    },
    /** 描画用のOption配列(ダミー時は[0]を削除したもの) */
    drawOptions (): string[] {
      if (this.note.type === 91) {
        return this.note.option.slice(1)
      }
      return this.note.option;
    },

    /**
     * mixinから取得する系の値
     */
    getDuplicated(): number {
      // @ts-ignore "isDuplicated" mixin
      return this.isDuplicated(this.note);
    },
    getError(): boolean | string {
      // @ts-ignore "hasError" mixin
      return this.hasError(this.note);
    },
    getOptions(): NoteTypesOption[] {
      // @ts-ignore "noteOptions" mixin
      return this.noteOptions(this.note);
    },
    getNoteTypes(): { text: string; value: number }[] {
      // @ts-ignore "noteTypes" mixin
      return this.noteTypes;
    },
    getIsLanelessNote(): boolean {
      // @ts-ignore "isLanelessNote" mixin
      return this.isLanelessNote(this.note);
    }
  }
});
</script>

<style lang="scss" scoped>
.v-card {
  &__text {
    padding: 0;
    text-align: left;
  }
  .v-input {
    &--radio-group__input .v-radio {
      margin: 0;
    }
  }
}
</style>
