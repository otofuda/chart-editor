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
          [`type${note.type}`]: true,
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
          v-if="note.type === 94"
          :src="note.option[0]"
          :style="{
            height: `${measure.measureHeight * note.option[2]}px`
          }"
          alt="texture"
        />

        <!-- コメントの時 -->
        <v-icon v-if="note.type === 100" color="warning" class="mt-2">
          mdi-comment
        </v-icon>
        <v-textarea
          outlined
          background-color="amber lighten-4"
          v-if="note.type === 100"
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

        <v-tooltip v-if="isDuplicated(note)" bottom>
          <template v-slot:activator="{ on, attrs }">
            <v-icon color="warning" dark v-bind="attrs" v-on="on" class="mt-2">
              mdi-alert
            </v-icon>
          </template>
          <span>{{ isDuplicated(note) }}個の重複</span>
        </v-tooltip>

        <v-tooltip v-if="hasError(note)" bottom>
          <template v-slot:activator="{ on, attrs }">
            <v-icon color="error" dark v-bind="attrs" v-on="on" class="mt-2">
              mdi-alert-circle-outline
            </v-icon>
          </template>
          <span>{{ hasError(note) }}</span>
        </v-tooltip>

        <strong v-if="note.type === 97">BEAT {{ note.option[0] }}</strong>
        {{ note.position }}/{{ note.split }}
        <strong v-if="note.type === 98">BPM {{ note.option[0] }}</strong>
        <strong v-if="note.type === 99">EOF</strong>
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
            :disabled="isLanelessNote(note)"
          >
            <v-radio v-for="n in 5" :key="n" :value="n"></v-radio>
          </v-radio-group>
        </v-list-item>

        <v-list-item>
          <v-select
            :items="noteTypes"
            hide-details
            label="ノート種別"
            v-model="note.type"
            align="left"
            outlined
            dense
            :menu-props="{ rounded: 'lg' }"
          ></v-select>
        </v-list-item>

        <v-list-item v-if="noteOptions(note).length > 0">
          <v-card-text>オプション</v-card-text>
          <v-spacer></v-spacer>
          <v-btn
            href="https://github.com/mtsgi/fumenedit/blob/master/format.md"
            target="_blank"
            icon
            right
          >
            <v-icon>mdi-help</v-icon>
          </v-btn>
        </v-list-item>

        <v-list-item v-for="(opt, i) in noteOptions(note)" :key="`option_${i}`">
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

<script>
import noteTypes from "../mixins/noteTypes";
import noteCheck from "../mixins/noteCheck";

export default {
  mixins: [noteTypes, noteCheck],
  inject: ["deleteNotes", "setAppendNoteInfo", "showSnackbar"],
  data() {
    return {
      menu: false
    };
  },
  props: {
    note: {
      type: Object,
      required: true
    },
    measure: {
      type: Object,
      required: true
    },
    // 重複判定に使用
    currentChart: {
      type: Array,
      required: true
    }
  },
  methods: {
    deleteThisNote() {
      this.deleteNotes(this.note.index);
      this.menu = false;
    },
    cloneThisNote() {
      this.setAppendNoteInfo({
        ...this.note,
        option: [...this.note.option],
        end: []
      });
      this.menu = false;
      this.showSnackbar("挿入ノートに同じデータをセットしました");
    },
    showNoteInfo() {
      this.showSnackbar(JSON.stringify(this.note, null, 2));
    }
  },
  computed: {
    positionLeft() {
      // TAP, ロング, 区切り線, コメント
      if ([1, 2, 95, 100].includes(this.note.type)) {
        return (this.note.lane - 1) * 60;
      }
      // フリック
      else if ([3, 4].includes(this.note.type)) {
        let _width = this.note.option[0] || 3;
        if (_width === -1) _width = 3;
        let _left = (this.note.lane - 1) * 60 + 30;
        let _offset = 0;
        if (this.note.option[1] && this.note.option[2]) {
          _offset = (this.note.option[1] / this.note.option[2]) * 60;
        }
        return _left - (_width / 2) * 60 + _offset;
      }
      // テクスチャ
      else if (this.note.type === 94) {
        let _width = this.note.option[1] || 1;
        let _left = (this.note.lane - 1) * 60 + 30;
        let _offset = 0;
        if (this.note.option[3] && this.note.option[4]) {
          _offset = (this.note.option[3] / this.note.option[4]) * 60;
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
    positionBottom() {
      return (
        (this.note.position / this.note.split) * this.measure.measureHeight
      );
    },
    noteWidth() {
      // TAP, ロング, コメント
      if ([1, 2, 100].includes(this.note.type)) return 60;
      // 左右フリック
      else if ([3, 4].includes(this.note.type)) {
        let _width = this.note.option[0] || 3;
        if (_width === -1) _width = 3;
        return 60 * _width;
      }
      // テクスチャ
      else if (this.note.type === 94) {
        let _width = this.note.option[1] || 1;
        return 60 * _width - 1;
      }
      // 区切り線
      else if (this.note.type === 95) {
        let _width = this.note.option[0] || 1;
        if (_width === -1) _width = 1;
        if (this.note.position === 0) _width = 5;
        return 60 * _width;
      }
      // LED制御
      else if (this.note.type === 96) {
        return 40;
      }
      // その他
      else return 300;
    },
    isHiddenControl() {
      return this.note.type === 95 && this.note.position === 0;
    },
    noteTypeName() {
      return this.noteTypes.find(t => t.value === this.note.type)?.text;
    },
    dispColor() {
      if (this.note.type === 96) {
        if (
          this.note.option[0] === -1 &&
          this.note.option[1] === -1 &&
          this.note.option[2] === -1
        ) {
          return "linear-gradient(0deg, #ff5151 20%, #44a5ff 80%)";
        } else
          return `rgb(${this.note.option[0]},${this.note.option[1]},${this.note.option[2]})`;
      }
      return null;
    }
  }
};
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
