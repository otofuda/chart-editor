import { describe, expect, it, vi } from 'vitest'
import type { ExtendedNoteData } from '../../types'
import { useChartData } from '../useChartData'
import { useNoteEditor } from '../useNoteEditor'
import { useSelection } from '../useSelection'

function note(overrides: Partial<ExtendedNoteData> = {}): ExtendedNoteData {
  return { index: 1, type: 1, lane: 1, measure: 0, position: 0, split: 8, option: [], end: [], ...overrides }
}

describe('譜面の操作履歴', () => {
  it('難易度をまたいで直前の編集を戻し、対象難易度を表示する', () => {
    const data = useChartData()
    const editor = useNoteEditor(data, vi.fn(), vi.fn())
    editor.appendNotes(note())
    data.currentDifficulty.value = 'hard'
    data.history.undo()
    expect(data.currentDifficulty.value).toBe('easy')
    expect(data.chartObject.value.easy).toEqual([])
    expect(data.history.canUndo.value).toBe(false)
    expect(data.history.canRedo.value).toBe(true)
    data.currentDifficulty.value = 'extra'
    data.history.redo()
    expect(data.currentDifficulty.value).toBe('easy')
    expect(data.currentChart.value[0]).toMatchObject(note())
  })

  it('index・未正規化option・再帰した終点と譜面情報を独立した値で復元する', () => {
    const data = useChartData()
    const source = note({ type: 2, index: 42, option: ['', ''], end: [note({
      type: 89, option: ['', '0', 'ease', '2'], end: [note({ measure: 2 })],
    })] })
    data.chartObject.value.easy = [source]
    data.history.run({ label: '編集', difficulties: [] }, () => {
      data.chartObject.value.easy[0].end[0].end[0].measure = 3
      data.chartObject.value.info = { version: 3, bpm: 180, beat: 3, offset: -120 }
    })
    data.history.undo()
    expect(data.currentChart.value[0]).toMatchObject({ ...source, end: [note({
      type: 89, option: ['', '0', 'ease', '2'], end: [note({ measure: 2 })],
    })] })
    expect(data.chartObject.value.info).toEqual({ version: 2, bpm: 120, beat: 4, offset: 0 })
    data.currentChart.value[0].end[0].option[2] = 'linear'
    data.history.redo()
    expect(data.currentChart.value[0].end[0].option[2]).toBe('ease')
    expect(data.currentChart.value[0].end[0].end[0].measure).toBe(3)
    expect(data.chartObject.value.info).toEqual({ version: 3, bpm: 180, beat: 3, offset: -120 })
  })

  it('無変更や選択だけの操作でRedoを失わず、新しい編集でだけ分岐を破棄する', () => {
    const data = useChartData()
    data.chartObject.value.easy = [note()]
    data.history.run({ label: '移動' }, () => { data.currentChart.value[0].position = 1 })
    data.history.undo()
    data.history.run({ label: '無変更' }, () => {})
    data.history.run({ label: '選択' }, () => { data.currentChart.value[0].isSelected = true })
    expect(data.history.entries.value.map(entry => entry.label)).toEqual(['移動'])
    expect(data.history.canRedo.value).toBe(true)
    data.history.run({ label: '別の移動' }, () => { data.currentChart.value[0].position = 2 })
    expect(data.history.canRedo.value).toBe(false)
    expect(data.history.entries.value.map(entry => entry.label)).toEqual(['別の移動'])
  })

  it('複合操作を一件にまとめ、例外では譜面を戻して履歴を増やさない', () => {
    const data = useChartData()
    data.chartObject.value.easy = [note()]
    data.history.run({ label: '移動' }, () => {
      data.history.run({ label: 'コピー' }, () => { data.chartObject.value.hard.push(note()) })
      data.deleteNotes(1)
    })
    expect(data.history.entries.value.map(entry => entry.label)).toEqual(['移動'])
    data.history.undo()
    expect(data.chartObject.value.hard).toEqual([])
    expect(data.currentChart.value).toHaveLength(1)
    expect(() => data.history.run({ label: '失敗' }, () => {
      data.currentChart.value.length = 0
      throw new Error('failed')
    })).toThrow('failed')
    expect(data.currentChart.value).toHaveLength(1)
    expect(data.history.canRedo.value).toBe(true)
  })

  it('入力中の変更をUndo可否に含め、確定してから一回で戻す', () => {
    const data = useChartData()
    let localBpm = 120
    data.history.beginEdit({ label: 'BPM', difficulties: [] }, {
      finish: () => { data.chartObject.value.info.bpm = localBpm },
      isDirty: () => localBpm !== data.chartObject.value.info.bpm,
    })
    // 通常のv-model入力と同じく、譜面の変更でリアクティブな更新を発生させる。
    data.chartObject.value.info.offset = 1
    localBpm = 180
    expect(data.history.canUndo.value).toBe(true)
    data.history.undo()
    expect(data.chartObject.value.info).toMatchObject({ bpm: 120, offset: 0 })
    expect(data.history.entries.value).toHaveLength(1)
    data.history.redo()
    expect(data.chartObject.value.info).toMatchObject({ bpm: 180, offset: 1 })
  })

  it('古い入力欄のblurは次の入力欄を確定しない', () => {
    const data = useChartData()
    const first = data.history.beginEdit({ label: 'BPM' })
    data.chartObject.value.info.bpm = 180
    data.history.beginEdit({ label: '拍子' })
    data.chartObject.value.info.beat = 3
    data.history.commitEdit(first)
    expect(data.history.entries.value).toHaveLength(1)
    data.history.commitEdit()
    expect(data.history.entries.value.map(entry => entry.label)).toEqual(['BPM', '拍子'])
  })

  it('入力を元の値へ戻すと履歴を増やさずRedoを維持する', () => {
    const data = useChartData()
    data.history.run({ label: 'BPM' }, () => { data.chartObject.value.info.bpm = 180 })
    data.history.undo()
    data.history.beginEdit({ label: '入力' })
    data.chartObject.value.info.bpm = 140
    expect(data.history.canRedo.value).toBe(false)
    data.chartObject.value.info.bpm = 120
    data.history.commitEdit()
    expect(data.history.canRedo.value).toBe(true)
    expect(data.history.entries.value).toHaveLength(1)
  })

  it('100件だけ保持し、打ち切り後の開始状態まで往復できる', () => {
    const data = useChartData()
    for (let i = 1; i <= 105; i++) {
      data.history.run({ label: `変更${i}` }, () => { data.chartObject.value.info.offset = i })
    }
    expect(data.history.entries.value).toHaveLength(100)
    expect(new Set(data.history.entries.value.map(entry => entry.id)).size).toBe(100)
    for (let i = 0; i < 100; i++) data.history.undo()
    expect(data.chartObject.value.info.offset).toBe(5)
    expect(data.history.canUndo.value).toBe(false)
    for (let i = 0; i < 100; i++) data.history.redo()
    expect(data.chartObject.value.info.offset).toBe(105)
    expect(data.history.canRedo.value).toBe(false)
  })

  it('生存するノーツの選択を維持し、削除から復活したノーツは未選択にする', () => {
    const data = useChartData()
    data.chartObject.value.easy = [note(), note({ index: 2, lane: 2, isSelected: true })]
    data.deleteNotes(2)
    data.currentChart.value[0].isSelected = true
    data.history.undo()
    expect(data.currentChart.value.map(item => item.isSelected)).toEqual([true, false])
    data.currentChart.value[0].isSelected = false
    data.history.redo()
    expect(data.currentChart.value.map(item => item.isSelected)).toEqual([false])
  })

  it('リセットは未確定の入力を捨て、復元前のフックを呼ぶ', () => {
    const data = useChartData()
    const finish = vi.fn()
    const before = vi.fn()
    const remove = data.history.onBeforeRestore(before)
    data.history.beginEdit({ label: '未確定' }, { finish })
    data.chartObject.value.info.bpm = 180
    data.history.reset()
    expect(finish).not.toHaveBeenCalled()
    expect(before).toHaveBeenCalledOnce()
    expect(data.history.canUndo.value).toBe(false)
    expect(data.history.entries.value).toEqual([])
    remove()
    data.history.reset()
    expect(before).toHaveBeenCalledOnce()
  })

  it('NaNとnull、空文字を区別し、数値編集中の値をそのまま保持する', () => {
    const data = useChartData()
    data.history.run({ label: '未入力' }, () => { data.chartObject.value.info.offset = NaN })
    data.history.run({ label: '空欄' }, () => { data.chartObject.value.info.offset = '' as any })
    data.history.undo()
    expect(data.chartObject.value.info.offset).toBeNaN()
    data.history.undo()
    expect(data.chartObject.value.info.offset).toBe(0)
  })
})

describe('編集composableと履歴の接続', () => {
  it('仮配置を記録せず、全難易度への挿入を一回で往復し仮配置は維持する', () => {
    const data = useChartData()
    const editor = useNoteEditor(data, vi.fn(), vi.fn())
    editor.placeNotes(note())
    expect(data.history.entries.value).toHaveLength(0)
    editor.appendSimultaneously(note())
    expect(data.history.entries.value).toHaveLength(1)
    data.currentDifficulty.value = 'hard'
    data.history.undo()
    expect(data.currentDifficulty.value).toBe('easy')
    data.difficulties.forEach(key => expect(data.chartObject.value[key]).toEqual([]))
    expect(editor.preAppendNotes.value).toHaveLength(1)
    data.history.redo()
    data.difficulties.forEach(key => expect(data.chartObject.value[key]).toHaveLength(1))
  })

  it('別難易度へのコピーではコピー先を表示し、重複による無変更は記録しない', () => {
    const data = useChartData()
    const editor = useNoteEditor(data, vi.fn(), vi.fn())
    editor.copyNotesToDifficulty('hard', note({ index: null }))
    data.history.undo()
    expect(data.currentDifficulty.value).toBe('hard')
    data.history.redo()
    editor.copyNotesToDifficulty('hard', note({ index: null }))
    expect(data.history.entries.value).toHaveLength(1)
  })

  it('選択ノーツと再帰した終点の小節変更を一回で戻し、選択操作は記録しない', () => {
    const data = useChartData()
    data.chartObject.value.easy = [note({ type: 2, isSelected: true, end: [note({
      measure: 1, end: [note({ measure: 2 })],
    })] }), note({ index: 2, lane: 2, isSelected: true })]
    const selection = useSelection(data, vi.fn())
    selection.selectionAddMeasure(3)
    expect(data.history.entries.value).toHaveLength(1)
    selection.selectionClear()
    expect(data.history.entries.value).toHaveLength(1)
    data.history.undo()
    expect(data.currentChart.value.map(item => item.measure)).toEqual([0, 0])
    expect(data.currentChart.value[0].end[0].end[0].measure).toBe(2)
    expect(data.currentChart.value.every(item => !item.isSelected)).toBe(true)
  })
})
