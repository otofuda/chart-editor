import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import NoteTypePie from '../NoteTypePie.vue'
import { useBackup } from '../../composables/useBackup'
import { useChartData } from '../../composables/useChartData'
import type { ExtendedNoteData } from '../../types'

const note = (type: number, index: number): ExtendedNoteData => ({
  index, type, lane: 1, measure: 0, position: 0, split: 8, option: [], end: [],
})

describe('種類別ノーツの円グラフ', () => {
  it('分析結果の判定対象7種類だけを数とともに表示する', () => {
    const chart = useChartData()
    const { analyze, analysisData } = useBackup(chart)
    chart.chartObject.value.easy = [
      ...[1, 1, 2, 3, 4, 5, 6, 7, 90, 96].map(note),
    ]
    analyze()
    const wrapper = mount(NoteTypePie, {
      props: { typeCount: analysisData.value.typeCount },
      global: { stubs: { VPie: true } },
    })
    const pie = wrapper.getComponent({ name: 'VPie' })
    const items = pie.props('items') as { key: number; title: string; value: number; color: string }[]

    expect(items.map(({ key, value }) => [key, value])).toEqual([
      [1, 2], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1],
    ])
    expect(items.map(item => item.title)).toEqual(['通常', 'ロング', '左フリック', '右フリック', '音札', '上フリック', '下フリック'])
    expect(items.slice(2).map(item => item.color)).toEqual(['#87cefa', '#f08080', '#ffd700', '#87f080', '#ec80f0'])
    expect(items.reduce((sum, item) => sum + item.value, 0)).toBe(analysisData.value.notesCount)
    expect(pie.props('legend')).toEqual({ position: 'right', textFormat: '[title] ([value])' })
    expect(pie.props('tooltip')).toBe(true)
  })

  it('ノーツなしや判定対象外のみの場合は空表示にし、単一種類を表示できる', async () => {
    const wrapper = mount(NoteTypePie, {
      props: { typeCount: {} },
      global: { stubs: { VPie: true } },
    })
    expect(wrapper.text()).toContain('表示するノーツがありません')
    expect(wrapper.findComponent({ name: 'VPie' }).exists()).toBe(false)

    await wrapper.setProps({ typeCount: { 90: 2, 96: 1 } })
    expect(wrapper.text()).toContain('表示するノーツがありません')

    await wrapper.setProps({ typeCount: { 2: 3, 90: 2 } })
    const items = wrapper.getComponent({ name: 'VPie' }).props('items') as { key: number; value: number }[]
    expect(items.map(({ key, value }) => [key, value])).toEqual([[2, 3]])
  })

  it('難易度を切り替えて再分析するとグラフが更新される', async () => {
    const chart = useChartData()
    const { analyze, analysisData } = useBackup(chart)
    chart.chartObject.value.easy = [note(1, 1)]
    chart.chartObject.value.hard = [note(5, 2), note(5, 3)]
    analyze()
    const wrapper = mount(NoteTypePie, {
      props: { typeCount: analysisData.value.typeCount },
      global: { stubs: { VPie: true } },
    })
    expect(wrapper.getComponent({ name: 'VPie' }).props('items')).toMatchObject([{ key: 1, value: 1 }])
    const previousPie = wrapper.getComponent({ name: 'VPie' }).vm

    chart.currentDifficulty.value = 'hard'
    analyze()
    await nextTick()
    expect(wrapper.getComponent({ name: 'VPie' }).props('items')).toMatchObject([{ key: 5, value: 2 }])
    expect(wrapper.getComponent({ name: 'VPie' }).vm).not.toBe(previousPie)
  })
})
