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
        :class="{
          [`type${note.type}`]: true,
          hidden: isHiddenControl
        }"
        :style="{
          left: `${positionLeft}px`,
          bottom: `${positionBottom}px`,
          width: `${noteWidth}px`
        }"
        v-bind="attrs"
        v-on="on"
      >
        {{ note.position }}/{{ note.split }}
        <strong v-if="note.type === 97">BEAT {{ note.option[0] }}</strong>
        <strong v-if="note.type === 98">BPM {{ note.option[0] }}</strong>
        <strong v-if="note.type === 99">EOF</strong>
      </span>
    </template>

    <!-- ポップアップ編集 -->
    <v-card>
      <v-list>
        <v-list-item>
          <v-card-text>ノートの配置場所</v-card-text>
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
                hide-details
                suffix="小節"
                outlined
                dense
                min="1"
                max="5"
              ></v-text-field>
            </v-col>
          </v-row>
        </v-list-item>

        <v-list-item>
          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="note.position"
                label="position"
                outlined
                dense
                hide-details
                type="number"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="note.split"
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
          <v-radio-group v-model="note.lane" row>
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
          ></v-select>
        </v-list-item>

        <v-list-item v-if="noteOptions.length > 0">
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
        <v-btn color="error" disabled text @click="menu = false">
          <v-icon left>mdi-delete</v-icon> ノートを削除
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script>
import noteTypes from "../mixins/noteTypes"

export default {
  mixins: [noteTypes],
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
    }
  },
  computed: {
    positionLeft() {
      if ([1, 2, 95].includes(this.note.type)) {
        return (this.note.lane - 1) * 60;
      } else if ([3, 4].includes(this.note.type)) {
        let _width = this.note.option[0] || 3;
        if (_width === -1) _width = 3;
        let _left = (this.note.lane - 1) * 60 + 30;
        let _offset = 0;
        if (this.note.option[1] && this.note.option[2]) {
          _offset = (this.note.option[1] / this.note.option[2]) * 60;
        }
        return _left - (_width / 2) * 60 + _offset;
      } else {
        return 0;
      }
    },
    positionBottom() {
      return (
        (this.note.position / this.note.split) * this.measure.measureHeight
      );
    },
    noteWidth() {
      // TAP, ロング
      if ([1, 2].includes(this.note.type)) return 60;
      // 左右フリック
      else if ([3, 4].includes(this.note.type)) {
        let _width = this.note.option[0] || 3;
        if (_width === -1) _width = 3;
        return 60 * _width;
      }
      // 区切り線
      else if (this.note.type === 95) {
        let _width = this.note.option[0] || 1;
        if (_width === -1) _width = 1;
        if (this.note.position === 0) _width = 5;
        return 60 * _width;
      } else return 300;
    },
    isHiddenControl() {
      return this.note.type === 95 && this.note.position === 0;
    }
  }
};
</script>

<style lang="scss" scoped>
span {
  position: absolute;
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
  &:hover {
    color: #909090;
  }
  &.type2 {
    background: #e9b75c;
  }
  &.type3 {
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
  &.type95 {
    height: 1px;
    background: #a0a0a0;
    &.hidden {
      background: transparent;
    }
  }
  &.type97 {
    height: 1px;
    background: greenyellow;
  }
  &.type98 {
    height: 1px;
    background: yellow;
  }
  &.type99 {
    height: 0;
    border-top: 2px dashed #ff5050;
  }
}

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
