import { describe, it, expect, vi } from 'vitest'
import { type LaneType } from 'chart-types'
import { useChartData } from '../useChartData'
import { useNoteEditor } from '../useNoteEditor'

function setup() {
  const chartData = useChartData()
  const showSnackbar = vi.fn()
  const scrollToMeasure = vi.fn()
  const editor = useNoteEditor(chartData, showSnackbar, scrollToMeasure)
  return { chartData, editor, showSnackbar, scrollToMeasure }
}

const sampleNote = { type: 1, lane: 1 as LaneType, measure: 0, position: 0, split: 8, option: [], end: [] }

describe('useNoteEditor - ノート仮配置', () => {
  it('初期状態で仮配置ノートは空', () => {
    const { editor } = setup()
    expect(editor.preAppendNotes.value.length).toBe(0)
  })

  it('placeNotesで仮配置ノートが追加される', () => {
    const { editor } = setup()
    editor.placeNotes(sampleNote)
    expect(editor.preAppendNotes.value.length).toBe(1)
  })

  it('cancelNoteで仮配置ノートが空になる', () => {
    const { editor } = setup()
    editor.placeNotes(sampleNote)
    editor.cancelNote(editor.preAppendNotes.value[0].index!)
    expect(editor.preAppendNotes.value.length).toBe(0)
  })
})

describe('useNoteEditor - ノート挿入', () => {
  it('appendNotesで現在の難易度に追加される', () => {
    const { chartData, editor } = setup()
    chartData.currentDifficulty.value = 'easy'
    editor.appendNotes(sampleNote)
    expect(chartData.currentChart.value.length).toBeGreaterThan(0)
  })

  it('appendNotesを呼ぶと仮配置がクリアされる', () => {
    const { editor } = setup()
    editor.appendNotes(sampleNote)
    expect(editor.preAppendNotes.value.length).toBe(0)
  })
})

describe('useNoteEditor - 難易度コピー', () => {
  it('copyNotesToDifficultyで別難易度にコピーされる', () => {
    const { chartData, editor } = setup()
    const sourceNote = { index: 1, type: 1, lane: 1 as LaneType, measure: 0, position: 0, split: 8, option: [], end: [] }
    chartData.chartObject.value.easy = [sourceNote]
    chartData.currentDifficulty.value = 'easy'
    editor.copyNotesToDifficulty('hard', sourceNote)
    expect(chartData.chartObject.value.hard.length).toBeGreaterThan(0)
  })
})

describe('useNoteEditor - ノーツ種別変更時のオプションリセット', () => {
  it('changeAppendNoteTypeを引数なしで呼ぶと現在のtypeに応じたオプションがセットされる', () => {
    const { editor } = setup()
    editor.appendNote.value.type = 3
    editor.changeAppendNoteType()
    expect(editor.appendNote.value.option).toEqual(['-1'])
  })

  it('changeAppendNoteTypeに引数を渡して呼ぶと指定したtypeに変更されてオプションがリセットされる', () => {
    const { editor } = setup()
    editor.changeAppendNoteType(96)
    expect(editor.appendNote.value.type).toBe(96)
    expect(editor.appendNote.value.option).toEqual(['255', '81', '81'])
  })
})

