import { NoteData } from "chart-types";
import Vue from "vue";

export type NoteTypesDataType = {
  noteTypes: { text: string; value: number }[];
};

export type NoteTypesOption = {
  label: string;
  type: string;
  desc: string;
}

export type NoteTypesMethodsType = {
  noteOptions(note: NoteData): NoteTypesOption[];
};

export default Vue.extend({
  data(): NoteTypesDataType {
    return {
      noteTypes: [
        {
          text: "通常",
          value: 1
        },
        {
          text: "ロング",
          value: 2
        },
        {
          text: "左フリック",
          value: 3
        },
        {
          text: "右フリック",
          value: 4
        },
        {
          text: "音札",
          value: 5
        },
        {
          text: "ダミー",
          value: 90
        },
        {
          text: "特殊オブジェクト",
          value: 91
        },
        {
          text: "譜面停止",
          value: 92
        },
        {
          text: "瞬間移動",
          value: 93
        },
        {
          text: "テクスチャ",
          value: 94
        },
        {
          text: "区切り線",
          value: 95
        },
        {
          text: "LED制御",
          value: 96
        },
        {
          text: "拍子変化",
          value: 97
        },
        {
          text: "BPM変化",
          value: 98
        },
        {
          text: "EOF",
          value: 99
        },
        {
          text: "コメント",
          value: 100
        }
      ]
    };
  },
  methods: {
    noteOptions(note: NoteData): NoteTypesOption[] {
      if ([3, 4].includes(note.type))
        return [
          {
            label: "width",
            type: "number",
            desc: "String型｜中心を基点とした横幅(単位：1レーンの幅)"
          },
          {
            label: "offsetNumer",
            type: "number",
            desc: "String型｜右側へのオフセット分数の分子"
          },
          {
            label: "offsetDenom",
            type: "number",
            desc: "String型｜右側へのオフセット分数の分母"
          }
        ];
      else if (note.type === 90) {
        // 擬態するtypeによって出し分け
        const additionalOptions = this.noteOptions({
          ...note,
          type: Number(note.option[0]),
        })
        return [
          {
            label: "type",
            type: "number",
            desc: "Integer型｜擬態するノート種別(対応type: 1, 2, 3, 4, 5)"
          },
          ...additionalOptions
        ];
      }
      else if (note.type === 91)
        return [
          {
            label: "objectType",
            type: "string",
            desc: "String型｜表示するオブジェクトの種類"
          },
          {
            label: "objectName",
            type: "string",
            desc: "String型｜表示するオブジェクト名"
          },
          {
            label: "option",
            type: "string",
            desc: "String型｜その他のフラグ"
          }
        ];
      else if (note.type === 93)
        return [
          {
            label: "beat",
            type: "number",
            desc: "Float型｜瞬間移動する小節の高さの拍子数"
          }
        ];
      else if (note.type === 94)
        return [
          {
            label: "source",
            type: "text",
            desc: "String型｜画像のソース(httpまたはhttpsプロトコル)"
          },
          {
            label: "width",
            type: "number",
            desc: "String型｜中心を基点とした横幅(単位：1レーンの幅)"
          },
          {
            label: "height",
            type: "number",
            desc: "String型｜下面を基点とした高さ(単位：1小節の高さ)"
          },
          {
            label: "offsetNumer",
            type: "number",
            desc: "String型｜右側へのオフセット分数の分子"
          },
          {
            label: "offsetDenom",
            type: "number",
            desc: "String型｜右側へのオフセット分数の分母"
          }
        ];
      else if (note.type === 95)
        return [
          {
            label: "length",
            type: "number",
            desc: "String型｜左面を基点とした横幅(単位：1レーンの幅)"
          }
        ];
      else if (note.type === 96)
        return [
          {
            label: "red",
            type: "number",
            desc: "String型｜0-255の整数"
          },
          {
            label: "green",
            type: "number",
            desc: "String型｜0-255の整数"
          },
          {
            label: "blue",
            type: "number",
            desc: "String型｜0-255の整数"
          }
        ];
      else if (note.type === 97)
        return [
          {
            label: "beat",
            type: "number",
            desc: "String型｜変化後の[n/4拍子]の分子の値"
          }
        ];
      else if (note.type === 98)
        return [
          {
            label: "bpm",
            type: "number",
            desc: "String型｜変化後のBPMの値"
          }
        ];
      else if (note.type === 100)
        return [
          {
            label: "comment",
            type: "text",
            desc: "String型｜コメント"
          }
        ];
      else return [];
    }
  }
});
