import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, type Component } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import Note from '../Note.vue'
import LongNote from '../LongNote.vue'
import EndForm from '../EndForm.vue'
import Measure from '../Measure.vue'
import HistoryControls from '../HistoryControls.vue'
import { useChartData } from '../../composables/useChartData'
import { useNoteEditor } from '../../composables/useNoteEditor'
import { vHistoryField } from '../../composables/useHistoryField'
import { chartHistoryKey, deleteNotesKey, showSnackbarKey, setAppendNoteInfoKey,
  appendNotesKey, copyNotesToDifficultyKey, getMovedNoteKey } from '../../composables/injectionKeys'
import type { ExtendedNoteData } from '../../types'

function note(overrides: Partial<ExtendedNoteData> = {}): ExtendedNoteData {
  return { index: 1, type: 1, lane: 1, measure: 0, position: 0, split: 8, option: [], end: [], ...overrides }
}

const layout = defineComponent({ setup: (_, { slots }) => () => h('div', [slots.default?.(), slots.append?.()]) })
const input = defineComponent({
  props: ['modelValue', 'label'], emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('input', {
    'aria-label': props.label, value: props.modelValue,
    onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
  }),
})
const stubs = {
  ...Object.fromEntries(['v-card', 'v-card-text', 'v-card-title', 'v-card-actions', 'v-row', 'v-col',
    'v-list', 'v-list-item', 'v-list-item-title', 'v-list-item-subtitle', 'v-spacer', 'v-divider',
    'v-alert', 'v-chip', 'v-radio', 'v-icon', 'v-tooltip'].map(name => [name, layout])),
  'v-text-field': input, 'v-textarea': input, 'v-select': input,
  'v-combobox': input, 'v-radio-group': input,
  'v-btn': defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }),
  'v-menu': defineComponent({
    props: ['modelValue'], emits: ['update:modelValue'],
    setup: (props, { emit, slots }) => () => h('div', [
      slots.activator?.({ props: { onClick: () => emit('update:modelValue', !props.modelValue) } }),
      slots.default?.(),
    ]),
  }),
}

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function setup(component: Component = Note, sources = [note()]) {
  const data = useChartData()
  data.chartObject.value.easy = sources
  const editor = useNoteEditor(data, vi.fn(), vi.fn())
  const host = defineComponent({ setup: () => () => data.currentChart.value[0] ? h(component, {
    note: data.currentChart.value[0], currentChart: data.currentChart.value,
    measure: data.measureData.value[0], measureData: data.measureData.value,
  }) : h('div') })
  const global = { stubs, provide: {
    [chartHistoryKey as symbol]: data.history,
    [deleteNotesKey as symbol]: data.deleteNotes,
    [showSnackbarKey as symbol]: vi.fn(),
    [setAppendNoteInfoKey as symbol]: editor.setAppendNoteInfo,
    [appendNotesKey as symbol]: editor.appendNotes,
    [copyNotesToDifficultyKey as symbol]: editor.copyNotesToDifficulty,
    [getMovedNoteKey as symbol]: editor.getMovedNote,
  } }
  const wrapper = mount(host, { attachTo: document.body, global })
  wrappers.push(wrapper)
  return { data, editor, wrapper, global }
}

describe('入力欄と履歴', () => {
  it('連続入力を一件にまとめ、欄が変わったら別の編集として扱う', async () => {
    const { data, wrapper } = setup()
    await wrapper.get('.note').trigger('click')
    const position = wrapper.get('input[aria-label="position"]')
    ;(position.element as HTMLInputElement).focus()
    await position.setValue('1')
    await position.setValue('2')
    expect(data.history.entries.value).toHaveLength(0)
    expect(data.history.canUndo.value).toBe(true)
    const split = wrapper.get('input[aria-label="split"]')
    ;(split.element as HTMLInputElement).focus()
    await split.setValue('16')
    ;(split.element as HTMLInputElement).blur()
    expect(data.history.entries.value).toHaveLength(2)
    data.history.undo()
    expect(data.currentChart.value[0]).toMatchObject({ position: 2, split: 8 })
    data.history.undo()
    expect(data.currentChart.value[0]).toMatchObject({ position: 0, split: 8 })
  })

  it('Enterで確定した後、同じ欄の次の入力は別の操作になる', async () => {
    const { data, wrapper } = setup()
    await wrapper.get('.note').trigger('click')
    const position = wrapper.get('input[aria-label="position"]')
    ;(position.element as HTMLInputElement).focus()
    await position.setValue('1')
    await position.trigger('keydown', { key: 'Enter' })
    await position.setValue('2')
    ;(position.element as HTMLInputElement).blur()
    expect(data.history.entries.value).toHaveLength(2)
    data.history.undo()
    expect(data.currentChart.value[0].position).toBe(1)
  })

  it.each([Note, LongNote])('未確定の小節入力を一度で戻し、閉じるメニューから再適用しない', async component => {
    const { data, wrapper } = setup(component, [note({ type: component === LongNote ? 2 : 1 })])
    await wrapper.get('.note').trigger('click')
    const measures = wrapper.findAll('input[type="number"]')
    const measure = measures[component === LongNote ? 1 : 0]
    ;(measure.element as HTMLInputElement).focus()
    ;(measure.element as HTMLInputElement).value = '2'
    await measure.trigger('input')
    expect(data.currentChart.value[0].measure).toBe(0)
    expect(data.history.canUndo.value).toBe(true)
    data.history.undo()
    await nextTick()
    expect(data.currentChart.value[0].measure).toBe(0)
    expect(wrapper.find('input[type="number"]').exists()).toBe(false)
    expect(data.history.entries.value).toHaveLength(1)
    data.history.redo()
    await nextTick()
    expect(data.currentChart.value[0].measure).toBe(2)
    expect(data.history.entries.value).toHaveLength(1)
  })

  it('同じindexの譜面を読み直した場合も古い小節入力を破棄する', async () => {
    const { data, wrapper } = setup()
    await wrapper.get('.note').trigger('click')
    await wrapper.get('input[type="number"]').setValue('5')
    const next = useChartData().chartObject.value
    next.easy = [note({ measure: 1 })]
    data.history.reset(next)
    await nextTick()
    expect(data.currentChart.value[0].measure).toBe(1)
    expect(data.history.entries.value).toHaveLength(0)
  })

  it('選択式の変更を一件ずつ記録し、先行する入力を確定する', async () => {
    const { data, wrapper } = setup()
    await wrapper.get('.note').trigger('click')
    await wrapper.get('input[aria-label="position"]').setValue('2')
    const select = wrapper.findAllComponents(input).find(field => field.props('label') === 'ノート種別')!
    select.vm.$emit('update:modelValue', 3)
    expect(data.history.entries.value).toHaveLength(2)
    data.history.undo()
    expect(data.currentChart.value[0]).toMatchObject({ type: 1, position: 2 })
    data.history.undo()
    expect(data.currentChart.value[0].position).toBe(0)
  })

  it('コメントの入力も集約し、文字編集で元に戻した場合は履歴を作らない', async () => {
    const { data, wrapper } = setup(Note, [note({ type: 100, lane: -1, option: ['元のコメント'] })])
    const comment = wrapper.get('.note input:not([type="checkbox"])')
    ;(comment.element as HTMLInputElement).focus()
    await comment.setValue('変更')
    await comment.setValue('元のコメント')
    ;(comment.element as HTMLInputElement).blur()
    expect(data.history.entries.value).toHaveLength(0)
    ;(comment.element as HTMLInputElement).focus()
    await comment.setValue('新しいコメント')
    ;(comment.element as HTMLInputElement).blur()
    data.history.undo()
    expect(data.currentChart.value[0].option).toEqual(['元のコメント'])
  })

  it('再帰した終点の編集と追加・削除をそれぞれ一件で往復できる', async () => {
    const { data, wrapper } = setup(LongNote, [note({ type: 2, end: [note({
      measure: 1, end: [note({ measure: 2 })],
    })] })])
    await wrapper.get('.note').trigger('click')
    const deepest = wrapper.findAllComponents(EndForm)[1]
    const width = deepest.get('input[aria-label="width"]')
    ;(width.element as HTMLInputElement).focus()
    await width.setValue('2.5')
    ;(width.element as HTMLInputElement).blur()
    expect(data.history.entries.value).toHaveLength(1)
    data.history.undo()
    await nextTick()
    expect(data.currentChart.value[0].end[0].end[0].option).toEqual([])
    data.history.redo()
    await nextTick()
    expect(data.currentChart.value[0].end[0].end[0].option).toEqual(['', '', '', '2.5'])
    await wrapper.get('.note').trigger('click')
    await wrapper.findAllComponents(EndForm)[1].findAll('button')[0].trigger('click')
    expect(data.currentChart.value[0].end[0].end[0].end).toHaveLength(1)
    expect(data.history.entries.value).toHaveLength(2)
    data.history.undo()
    await nextTick()
    expect(data.currentChart.value[0].end[0].end[0].end).toEqual([])
    await wrapper.get('.note').trigger('click')
    await wrapper.findAllComponents(EndForm)[1].findAll('button')[1].trigger('click')
    expect(data.currentChart.value[0].end[0].end).toEqual([])
    data.history.undo()
    expect(data.currentChart.value[0].end[0].end).toHaveLength(1)
  })

  it('仮配置の再帰フォームは履歴に入れない', async () => {
    const data = useChartData()
    const draft = note({ type: 2, end: [note()] })
    const wrapper = mount(EndForm, {
      attachTo: document.body, props: { end: draft.end[0], parent: draft, index: 0 },
      global: { stubs, provide: { [chartHistoryKey as symbol]: data.history } },
    })
    wrappers.push(wrapper)
    await wrapper.get('input[aria-label="lane"]').setValue('3')
    await wrapper.findAll('button')[0].trigger('click')
    data.history.commitEdit()
    expect(data.history.entries.value).toEqual([])
    expect(draft.end[0].end).toHaveLength(1)
  })

  it('保存で確定した後も、終点position欄の矢印操作を新しい編集として記録する', async () => {
    const { data, wrapper } = setup(LongNote, [note({ type: 2, end: [note({ measure: 1 })] })])
    await wrapper.get('.note').trigger('click')
    const position = wrapper.findAllComponents(EndForm)[0].get('input[aria-label="position"]')
    ;(position.element as HTMLInputElement).focus()
    await position.setValue('1')
    data.history.commitEdit()
    await position.trigger('keydown', { key: 'ArrowRight' })
    ;(position.element as HTMLInputElement).blur()
    expect(data.history.entries.value).toHaveLength(2)
    data.history.undo()
    expect(data.currentChart.value[0].end[0]).toMatchObject({ position: 1, lane: 1 })
    data.history.undo()
    expect(data.currentChart.value[0].end[0].position).toBe(0)
  })

  it('終点position欄のShift+矢印で動かしたロング全体を1回のUndoで戻し、境界で動かない操作は履歴を作らない', async () => {
    const child = note({ lane: 3, measure: 1, position: 2, split: 8 })
    const mid = note({ lane: 2, measure: 0, position: 7, split: 8, end: [child] })
    const root = note({ type: 2, lane: 0 as ExtendedNoteData['lane'], measure: 0, position: 6, split: 8, end: [mid] })
    const { data, wrapper } = setup(LongNote, [root])

    await wrapper.get('.note').trigger('click')

    const childPosition = wrapper.findAllComponents(EndForm)[1].get('input[aria-label="position"]')
    ;(childPosition.element as HTMLInputElement).focus()

    // 始点がレーン 0 の状態で左移動しても範囲外のため動かず、履歴も作らない。
    await childPosition.trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    ;(childPosition.element as HTMLInputElement).blur()

    expect(data.history.entries.value).toHaveLength(0)

    // 右移動と小節をまたぐ上移動を連続で行い、メニューを閉じても1操作にまとまる。
    ;(childPosition.element as HTMLInputElement).focus()
    await childPosition.trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    await childPosition.trigger('keydown', { key: 'ArrowUp', shiftKey: true })
    await childPosition.trigger('keydown', { key: 'ArrowUp', shiftKey: true })
    ;(childPosition.element as HTMLInputElement).blur()

    expect(data.currentChart.value[0]).toMatchObject({ lane: 1, measure: 1, position: 0, split: 8 })
    expect(data.currentChart.value[0].end[0]).toMatchObject({ lane: 3, measure: 1, position: 1, split: 8 })
    expect(data.currentChart.value[0].end[0].end[0]).toMatchObject({ lane: 4, measure: 1, position: 4, split: 8 })
    expect(data.history.entries.value).toHaveLength(1)

    data.history.undo()
    await nextTick()

    expect(data.currentChart.value[0]).toMatchObject({ lane: 0, measure: 0, position: 6, split: 8 })
    expect(data.currentChart.value[0].end[0]).toMatchObject({ lane: 2, measure: 0, position: 7, split: 8 })
    expect(data.currentChart.value[0].end[0].end[0]).toMatchObject({ lane: 3, measure: 1, position: 2, split: 8 })
  })

  it('comboboxの連続入力をまとめ、空欄を0へ変換しない', async () => {
    const { data, wrapper } = setup(LongNote, [note({ type: 2 })])
    await wrapper.get('.note').trigger('click')
    const split = wrapper.get('input[aria-label="split"]')
    ;(split.element as HTMLInputElement).focus()
    await split.setValue('1')
    await split.setValue('16')
    expect(data.history.entries.value).toHaveLength(0)
    ;(split.element as HTMLInputElement).blur()
    expect(data.history.entries.value).toHaveLength(1)
    ;(split.element as HTMLInputElement).focus()
    await split.setValue('')
    expect(data.currentChart.value[0].split).toBe('')
    ;(split.element as HTMLInputElement).blur()
    data.history.undo()
    expect(data.currentChart.value[0].split).toBe(16)
    data.history.undo()
    expect(data.currentChart.value[0].split).toBe(8)
  })

  it('譜面情報の入力中からボタンを有効にし、初回編集を取り消せる', async () => {
    const data = useChartData()
    const host = defineComponent({
      directives: { historyField: vHistoryField },
      components: { HistoryControls },
      setup: () => ({ data, config: { history: data.history, meta: { label: 'BPM', difficulties: [] } } }),
      template: `<input v-model.number="data.chartObject.value.info.bpm" v-history-field="config" />
        <HistoryControls :history="data.history" @undo="data.history.undo()" @redo="data.history.redo()" />`,
    })
    const wrapper = mount(host, { attachTo: document.body, global: { stubs } })
    wrappers.push(wrapper)
    expect(wrapper.get('[data-testid="undo"]').attributes('disabled')).toBeDefined()
    const field = wrapper.get('input')
    ;(field.element as HTMLInputElement).focus()
    await field.setValue('180')
    expect(wrapper.get('[data-testid="undo"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-testid="undo"]').trigger('click')
    expect(data.chartObject.value.info.bpm).toBe(120)
  })
})

describe('小節メニューと履歴一覧', () => {
  it('別難易度への小節移動を一回で戻す', async () => {
    const { data, global } = setup(Note, [note(), note({ index: 2, lane: 2 })])
    const wrapper = mount(Measure, {
      props: { notes: data.currentChart.value, measure: data.measureData.value[0], currentDifficulty: 'easy' }, global,
    })
    wrappers.push(wrapper)
    await wrapper.get('input[aria-label="複製先難易度"]').setValue('hard')
    await wrapper.findAll('button').find(button => button.text() === '移動')!.trigger('click')
    expect(data.chartObject.value.easy).toHaveLength(0)
    expect(data.chartObject.value.hard).toHaveLength(2)
    expect(data.history.entries.value).toHaveLength(1)
    data.history.undo()
    expect(data.chartObject.value.easy).toHaveLength(2)
    expect(data.chartObject.value.hard).toHaveLength(0)
  })

  it('操作一覧で現在位置と取り消し済みを区別し、分岐後は古いRedoを表示しない', async () => {
    const data = useChartData()
    const wrapper = mount(HistoryControls, { props: { history: data.history }, global: { stubs } })
    wrappers.push(wrapper)
    await wrapper.findAll('button')[2].trigger('click')
    expect(wrapper.text()).toContain('操作履歴はありません')
    data.history.run({ label: 'BPM', difficulties: [] }, () => { data.chartObject.value.info.bpm = 180 })
    data.history.run({ label: '拍子', difficulties: [] }, () => { data.chartObject.value.info.beat = 3 })
    data.history.undo()
    await nextTick()
    expect(wrapper.get('[aria-current="step"]').text()).toContain('BPM')
    expect(wrapper.get('.history-undone').text()).toContain('拍子')
    expect(wrapper.get('.history-undone').text()).toContain('取り消し済み')
    data.history.run({ label: 'オフセット', difficulties: [] }, () => { data.chartObject.value.info.offset = 50 })
    await nextTick()
    expect(wrapper.text()).not.toContain('拍子')
    expect(wrapper.get('[aria-current="step"]').text()).toContain('オフセット')
    data.history.undo()
    data.history.undo()
    await nextTick()
    expect(wrapper.text()).toContain('現在位置：開始状態')
  })
})
