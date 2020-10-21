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
          value: 5,
          disabled: true
        },
        {
          text: "区切り線",
          value: 95
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
            type: "number"
          },
          {
            label: "offsetNumer",
            type: "number"
          },
          {
            label: "offsetDenom",
            type: "number"
          }
        ];
      else if (note.type === 95)
        return [
          {
            label: "length",
            type: "number"
          }
        ];
      else if (note.type === 97)
        return [
          {
            label: "beat",
            type: "number"
          }
        ];
      else if (note.type === 98)
        return [
          {
            label: "bpm",
            type: "number"
          }
        ];
      else return [];
    }
  }
};
