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

  it('仮配置と挿入で同じoption補完を適用する', () => {
    const { chartData, editor } = setup()
    const note = { ...sampleNote, type: 3, option: ['', '', '', '', '2'] }
    editor.placeNotes(note)
    expect(editor.preAppendNotes.value[0].option).toEqual(['-1', '0', '1', '1', '2'])
    editor.appendNotes(editor.preAppendNotes.value[0])
    expect(chartData.currentChart.value.at(-1)?.option).toEqual(['-1', '0', '1', '1', '2'])
    expect(note.option).toEqual(['', '', '', '', '2'])
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

describe('useNoteEditor - 全難易度同時挿入', () => {
  it('appendSimultaneously で全難易度にノートが追加され、index が 1 始まりで一意に採番される', () => {
    const { chartData, editor } = setup()
    // easy に既存ノートを配置
    chartData.chartObject.value.easy = [
      { index: 1, type: 1, lane: 2 as LaneType, measure: 0, position: 0, split: 8, option: [], end: [] }
    ]
    editor.appendSimultaneously(sampleNote)

    // 空だった難易度は index: 1
    expect(chartData.chartObject.value.normal.length).toBe(1)
    expect(chartData.chartObject.value.normal[0].index).toBe(1)

    // 既に index: 1 があった easy は index: 2
    expect(chartData.chartObject.value.easy.length).toBe(2)
    expect(chartData.chartObject.value.easy[1].index).toBe(2)
  })

  it.each([1, 2])('通常挿入したtype:%sのノーツは、同時挿入したLEDを削除しても残る', type => {
    const { chartData, editor } = setup()
    const end = type === 2 ? [{ ...sampleNote, measure: 1 }] : []
    editor.appendNotes({ ...sampleNote, type, end })
    const original = JSON.parse(JSON.stringify(chartData.currentChart.value[0]))

    editor.appendSimultaneously({ ...sampleNote, type: 96, lane: -1, measure: 2, option: ['255', '0', '0'] })
    const led = chartData.currentChart.value.find(note => note.type === 96)!
    chartData.deleteNotes(led.index!)

    expect(chartData.currentChart.value).toEqual([original])
    expect(chartData.chartObject.value.hard).toHaveLength(1)
    expect(chartData.chartObject.value.hard[0].type).toBe(96)
  })

  it('削除で欠番ができた各難易度でも、複数のLEDを同時挿入して削除すると既存ノーツが残る', () => {
    const { chartData, editor } = setup()
    const originals = chartData.difficulties.map((difficulty, i) => {
      chartData.currentDifficulty.value = difficulty
      chartData.chartObject.value[difficulty] = Array.from({ length: i + 3 }, (_, index) => ({
        ...sampleNote, index, measure: index,
      }))
      chartData.deleteNotes(0)
      return chartData.currentChart.value.slice()
    })

    editor.appendSimultaneously(
      { ...sampleNote, type: 96, lane: -1, measure: 10, option: ['255', '0', '0'] },
      { ...sampleNote, type: 96, lane: -1, measure: 11, option: ['0', '0', '255'] },
    )

    chartData.difficulties.forEach((difficulty, i) => {
      chartData.currentDifficulty.value = difficulty
      const chart = chartData.currentChart.value
      expect(chart).toHaveLength(originals[i].length + 2)
      expect(new Set(chart.map(note => note.index)).size).toBe(chart.length)
      const leds = chart.filter(note => note.type === 96)
      chartData.deleteNotes(...leds.map(note => note.index!))
      expect(chartData.currentChart.value).toEqual(originals[i])
    })
  })
})
