export default {
  data() {
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
    noteOptions(note) {
      if ([3, 4].includes(note.type))
        return [
          {
            label: "width",
            type: "number",
            desc: "Float型｜中心を基点とした横幅(単位：1レーンの幅)"
          },
          {
            label: "offsetNumer",
            type: "number",
            desc: "Integer型｜右側へのオフセット分数の分子"
          },
          {
            label: "offsetDenom",
            type: "number",
            desc: "Integer型｜右側へのオフセット分数の分母"
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
            desc: "Float型｜中心を基点とした横幅(単位：1レーンの幅)"
          },
          {
            label: "height",
            type: "number",
            desc: "Float型｜下面を基点とした高さ(単位：1小節の高さ)"
          },
          {
            label: "offsetNumer",
            type: "number",
            desc: "Integer型｜右側へのオフセット分数の分子"
          },
          {
            label: "offsetDenom",
            type: "number",
            desc: "Integer型｜右側へのオフセット分数の分母"
          }
        ];
      else if (note.type === 95)
        return [
          {
            label: "length",
            type: "number",
            desc: "Integer型｜左面を基点とした横幅(単位：1レーンの幅)"
          }
        ];
      else if (note.type === 96)
        return [
          {
            label: "red",
            type: "number",
            desc: "Integer型｜0-255の整数"
          },
          {
            label: "green",
            type: "number",
            desc: "Integer型｜0-255の整数"
          },
          {
            label: "blue",
            type: "number",
            desc: "Integer型｜0-255の整数"
          }
        ];
      else if (note.type === 97)
        return [
          {
            label: "beat",
            type: "number",
            desc: "Integer型｜変化後の[n/4拍子]の分子の値"
          }
        ];
      else if (note.type === 98)
        return [
          {
            label: "bpm",
            type: "number",
            desc: "Float型｜変化後のBPMの値"
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
};
