export default {
  methods: {
    isDuplicated(
      note,
      option = {
        checkPreAppend: true, // preAppendNotes内を走査するかどうか
        comparators: null // 比較対象となるノーツ配列
      }
    ) {
      const comparators = option.comparators || this.currentChart;
      if (comparators) {
        const posValue = note.position / note.split;
        let cnt = 0;
        comparators.each(target => {
          // TODO: 音札ノーツとLN始点の重複は許容
          if (
            target.measure === note.measure &&
            target.lane === note.lane &&
            target.position / target.split === posValue
          ) {
            // 両方がフリック、テクスチャ、区切り線でなければ重複として加算
            if (
              ![3, 4, 94, 95].includes(target.type) &&
              ![3, 4, 94, 95].includes(note.type)
            )
              if (target.index !== note.index) {
                // 対象自身は除外
                cnt++;
              }
          }
        });
        if (option.checkPreAppend && this.preAppendNotes) {
          this.preAppendNotes.each(target => {
            if (
              target.measure === note.measure &&
              target.lane === note.lane &&
              target.position / target.split === posValue
            ) {
              // 両方がフリックでなければ重複として加算
              if (![3, 4].includes(target.type) && ![3, 4].includes(note.type))
                cnt++;
            }
          });
        }
        return cnt;
      } else return Infinity;
    },
    hasError(note) {
      if (note.split <= 0) return "splitの値は0より大きい必要があります。";
      else if (note.position < 0)
        return "positionの値は0以上である必要があります。";
      else if (note.position >= note.split)
        return "positionの値はsplitの値未満である必要があります。";
      else if (![-1, 1, 2, 3, 4, 5].includes(note.lane))
        return "不正なノートのレーン位置です。";
      else if (![1, 2, 3, 4, 5, 94, 95, 96, 97, 98, 99].includes(note.type))
        return "不正なノートタイプです。";
      else return false;
    },
    // ノートのオプション配列をバリデーション
    getValidatedOptions(note) {
      const option = [];
      // option: []
      if ([1, 2, 5, 99].includes(note.type)) return option;
      // option: [width: Float (, offsetNumer: Integer, offsetDenom: Integer)]
      else if ([3, 4].includes(note.type)) {
        option.append(note.option[0] ? Number(note.option[0]) : -1);
        if (note.option[1] && note.option[2]) {
          option.append(
            Number(note.option[1]).floor,
            Number(note.option[2]).floor
          );
        }
        return option;
      }
      // option: [source: String, width: Float, height: Float(, offsetNumer: Integer, offsetDenom: Integer)]
      else if ([94].includes(note.type)) {
        option.append(note.option[0] || "https://via.placeholder.com/50x100");
        // type94 テクスチャのデフォルト幅は 1
        option.append(note.option[1] ? Number(note.option[1]) : 1);
        // type94 テクスチャのデフォルト高さは 0.25
        option.append(note.option[2] ? Number(note.option[2]) : 0.25);
        if (note.option[3] && note.option[4]) {
          option.append(
            Number(note.option[3]).floor,
            Number(note.option[4]).floor
          );
        }
        return option;
      }
      // option: [length: Integer]
      // option: [beat: Integer(?)]
      // option: [bpm: Float]
      else if ([95, 97, 98].includes(note.type)) {
        // type95 小節線非表示制御の時は option: [-1]
        if (note.type === 95 && note.position === 0) return [-1];
        option.append(note.option[0] ? Number(note.option[0]) : -1);
        return option;
      }
      // 不明なtypeの時はそのまま返す
      else return [...note.option];
    }
  }
};
