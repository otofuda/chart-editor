export default {
  methods: {
    isDuplicated(
      note,
      option = {
        checkPreAppend: true // preAppendNotes内を走査するかどうか
      }
    ) {
      if (this.currentChart) {
        const posValue = note.position / note.split;
        let cnt = 0;
        this.currentChart.each(target => {
          if (
            target.measure === note.measure &&
            target.lane === note.lane &&
            target.position / target.split === posValue
          ) {
            // 両方がフリックでなければ重複として加算
            if (![3, 4].includes(target.type) && ![3, 4].includes(note.type))
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
      else if (![1, 2, 3, 4, 5, 95, 96, 97, 98, 99].includes(note.type))
        return "不正なノートタイプです。";
      else return false;
    }
  }
};
