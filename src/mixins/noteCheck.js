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
          // 同じ音符位置かつ同じレーンのノーツを検査
          if (
            target.measure === note.measure &&
            target.lane === note.lane &&
            target.position / target.split === posValue
          ) {
            // テクスチャと[any]の重複は許容
            if (target.type === 94 || note.type === 94) return;

            // [フリック|区切り線]と[フリック|区切り線]
            // (ただし同じTypeでない)の重複は許容
            if (
              [3, 4, 94, 95].includes(target.type) &&
              [3, 4, 94, 95].includes(note.type) &&
              target.type !== note.type
            ) {
              return;
            }
            // 音札ノーツとLN始点の重複は許容
            if (
              (target.type === 5 && note.type === 2) ||
              (target.type === 2 && note.type === 5)
            ) {
              return;
            }
            // 対象自身は除外
            if (target.index === note.index) return;

            // 重複を発見 カウンターを1増やす
            cnt++;
          }
        });
        if (option.checkPreAppend && this.preAppendNotes) {
          this.preAppendNotes.each(target => {
            // 同じ音符位置かつ同じレーンのノーツを検査
            if (
              target.measure === note.measure &&
              target.lane === note.lane &&
              target.position / target.split === posValue
            ) {
              // [フリック|テクスチャ|区切り線]と[フリック|テクスチャ|区切り線]
              // (ただし同じTypeでない)の重複は許容
              if (
                [3, 4, 94, 95].includes(target.type) &&
                [3, 4, 94, 95].includes(note.type) &&
                target.type !== note.type
              ) {
                return;
              }
              // 音札ノーツとLN始点の重複は許容
              if (
                (target.type === 5 && note.type === 2) ||
                (target.type === 2 && note.type === 5)
              ) {
                return;
              }

              // 重複を発見 カウンターを1増やす
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
      else if (
        ![1, 2, 3, 4, 5, 94, 95, 96, 97, 98, 99, 100].includes(note.type)
      )
        return "不正なノートタイプです。";
      else return false;
    },
    /** ノートをバリデーション */
    getValidatedNote(note) {
      const type = Number(note.type);

      // type: 5 は lane: 3
      // type: 96, 97, 98, 99は lane: -1
      let lane = Number(note.lane);
      if (type === 5) lane = 3;
      if ([96, 97, 98, 99].includes(type)) lane = -1;

      // type: 2 以外は end: []
      let end = [];
      if (note.type === 2) {
        end = [...note.end].map(this.getValidatedNote);
      }

      return {
        type,
        measure: Number(note.measure),
        lane,
        position: Number(note.position),
        split: Number(note.split),
        option: this.getValidatedOptions(note),
        end
      };
    },
    /** ノートのオプション配列をバリデーション */
    getValidatedOptions(note) {
      /** @type string[] */
      const option = []; // optionはStringの配列

      // option: []
      if ([1, 2, 5, 99].includes(note.type)) return option;

      // フリックの場合
      // option: [width: String (, offsetNumer: String, offsetDenom: String)]
      else if ([3, 4].includes(note.type)) {
        option.append(note.option[0] ? String(note.option[0]) : "-1");
        if (note.option[1] && note.option[2]) {
          option.append(
            String(note.option[1]),
            String(note.option[2])
          );
        }
        return option;
      }

      // テクスチャの場合
      // option: [source: String, width: String, height: String(, offsetNumer: String, offsetDenom: String)]
      else if ([94].includes(note.type)) {
        option.append(note.option[0] || "https://via.placeholder.com/50x100");
        // type94 テクスチャのデフォルト幅は 1
        option.append(note.option[1] ? String(note.option[1]) : "1");
        // type94 テクスチャのデフォルト高さは 0.25
        option.append(note.option[2] ? String(note.option[2]) : "0.25");
        if (note.option[3] && note.option[4]) {
          option.append(
            String(note.option[3]),
            String(note.option[4])
          );
        }
        return option;
      }

      // 区切り線、拍子変化、BPM変化の場合
      // option: [length: String]
      // option: [beat: String]
      // option: [bpm: String]
      else if ([95, 97, 98].includes(note.type)) {
        // type95 小節線非表示制御の時は option: ["-1"]
        if (note.type === 95 && note.position === 0) return ["-1"];

        option.append(note.option[0] ? String(note.option[0]) : "-1");
        return option;
      }

      // LED制御の場合
      // option: [r: String, g: String, b: String]
      else if ([96].includes(note.type)) {
        option.append(
          String(note.option[0]),
          String(note.option[1]),
          String(note.option[2])
        );
        return option;
      }

      // コメントの場合
      // option: [comment: String]
      else if ([100].includes(note.type)) {
        option.append(
          note.option && note.option[0] ? String(note.option[0]) : ""
        );
        return option;
      }

      // 不明なtypeの時は全部Stringにしてそのまま返す
      else return [...note.option].map((opt) => String(opt));
    },

    // lane: -1 固定ノートであるか
    isLanelessNote(note) {
      return [5, 96, 97, 98, 99].includes(note.type);
    }
  }
};
