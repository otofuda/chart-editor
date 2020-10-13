export default {
  methods: {
    isDuplicated(
      note,
      option = {
        checkPreAppend: true
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
              cnt++;
          }
        });
        if (option.checkPreAppend && this.preAppendNotes) {
          this.preAppendNotes.each(target => {
            if (
              target.measure === note.measure &&
              target.lane === note.lane &&
              target.position / target.split === posValue
            ) {
              if (![3, 4].includes(target.type) && ![3, 4].includes(note.type))
                cnt++;
            }
          });
        }
        return cnt;
      } else return Infinity;
    }
  }
};
