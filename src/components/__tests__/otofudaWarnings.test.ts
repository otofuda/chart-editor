import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import App from '../../App.vue'
import Note from '../Note.vue'
import ObjectBasedMeasure from '../ObjectBasedMeasure.vue'
import * as chartModule from '../../composables/useChartData'
import { ControlledFileReader } from '../../composables/__tests__/controlledFileReader'
import type { ExtendedNoteData } from '../../types'

vi.mock('vuetify', () => ({ useGoTo: () => () => {} }))

// 譜面と警告は実際のコンポーネントを使い、Vuetifyの装飾のみ置き換える。
const layout = defineComponent({
  setup: (_, { slots }) => () => h('div', [slots.default?.(), slots.actions?.()]),
})
const activator = defineComponent({
  setup: (_, { slots }) => () => h('div', [
    slots.activator?.({ props: {} }), slots.default?.(),
  ]),
})
const checkbox = defineComponent({
  props: ['label', 'modelValue', 'disabled'], emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('input', {
    type: 'checkbox', 'aria-label': props.label, checked: props.modelValue,
    disabled: props.disabled,
    onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).checked),
  }),
})
const textField = defineComponent({
  props: ['label', 'modelValue', 'type'], emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('input', {
    'aria-label': props.label, value: props.modelValue, type: props.type,
    onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
  }),
})
const fileInput = defineComponent({
  props: ['label'], emits: ['update:modelValue'],
  setup: props => () => h('input', { type: 'file', 'aria-label': props.label }),
})
const stubs = {
  ...Object.fromEntries([
    'v-app', 'v-container', 'v-row', 'v-col', 'v-spacer', 'v-select', 'v-combobox', 'v-alert',
    'v-card', 'v-list', 'v-list-item', 'v-list-item-title', 'v-list-item-subtitle',
    'v-card-title', 'v-card-text', 'v-divider', 'v-card-actions', 'v-expansion-panels',
    'v-expansion-panel', 'v-expansion-panel-title', 'v-expansion-panel-text',
    'v-btn-group', 'v-badge', 'v-chip', 'v-slider', 'v-color-picker', 'v-img',
    'v-radio', 'v-radio-group', 'v-snackbar', 'v-tab', 'v-table', 'v-tabs',
    'v-window', 'v-window-item', 'v-textarea',
  ].map(name => [name, layout])),
  'v-menu': activator,
  'v-tooltip': activator,
  'v-checkbox': checkbox,
  'v-switch': checkbox,
  'v-text-field': textField,
  'v-file-input': fileInput,
  'v-dialog': true,
  'v-btn': defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }),
  'v-icon': defineComponent({ setup: (_, { slots }) => () => h('i', { class: 'v-icon' }, slots.default?.()) }),
  EndForm: true, LongNote: true, NoteShadow: true, DensityGraph: true,
  NoteTypePie: true, ThemeToggle: true, HistoryControls: true,
}

let wrapper: VueWrapper | undefined
const warningSelector = '.v-icon[aria-label^="音札ノーツ位置が一致していません"]'

beforeEach(() => {
  localStorage.clear()
  ControlledFileReader.instances = []
  vi.stubGlobal('FileReader', ControlledFileReader)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ contents: [] }) }))
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function note(overrides: Partial<ExtendedNoteData> = {}): ExtendedNoteData {
  return {
    index: 1, type: 5, lane: 3, measure: 0, position: 1, split: 4,
    option: [], end: [], ...overrides,
  }
}

function setup() {
  const data = chartModule.useChartData()
  for (const difficulty of data.difficulties) data.chartObject.value[difficulty] = [note()]
  vi.spyOn(chartModule, 'useChartData').mockReturnValue(data)
  wrapper = mount(App, { global: { stubs } })
  return data
}

async function clickButton(label: string) {
  await wrapper!.findAll('button').find(button => button.text() === label)!.trigger('click')
}

describe('音札ノーツの全難易度一致警告', () => {
  it('他難易度の追加・削除・種別変更と難易度切替に追従する', async () => {
    const data = setup()
    expect(wrapper!.find(warningSelector).exists()).toBe(false)
    data.chartObject.value.hard = []
    await nextTick()
    expect(wrapper!.getComponent(Note).get(warningSelector).attributes('aria-label'))
      .toBe('音札ノーツ位置が一致していません：HARD')

    data.chartObject.value.hard.push(note({ position: 2, split: 8 }))
    await nextTick()
    expect(wrapper!.find(warningSelector).exists()).toBe(false)

    data.chartObject.value.hard[0].type = 90
    data.chartObject.value.hard[0].option = ['5']
    await nextTick()
    expect(wrapper!.getComponent(Note).text()).toContain('音札ノーツ位置が一致していません：HARD')
    await clickButton('HARD')
    expect(data.currentDifficulty.value).toBe('hard')
    expect(wrapper!.getComponent(Note).get('.note').classes()).toContain('isDummy')
    expect(wrapper!.find(warningSelector).exists()).toBe(false)

    data.chartObject.value.hard[0].type = 5
    await nextTick()
    expect(wrapper!.find(warningSelector).exists()).toBe(false)
  })

  it('Object表示で位置を編集すると警告が現れ、分母を揃えると消える', async () => {
    const data = setup()
    await wrapper!.get('input[aria-label="Object表示モード"]').setValue(true)
    const objects = wrapper!.getComponent(ObjectBasedMeasure)
    await objects.get('input[aria-label="position"]').setValue('2')
    expect(data.chartObject.value.easy[0].position).toBe(2)
    expect(objects.get('[type="warning"]').text())
      .toBe('音札ノーツ位置が一致していません：RAKU、NORMAL、HARD、EXTRA')
    await objects.get('input[aria-label="split"]').setValue('8')
    expect(objects.find('[type="warning"]').exists()).toBe(false)
    expect(objects.find(warningSelector).exists()).toBe(false)
  })

  it('通常表示とObject表示で、既存の重複・入力エラーと併存する', async () => {
    const data = setup()
    data.chartObject.value.hard = []
    data.chartObject.value.easy = [note({ lane: 1 }), note({ index: 2, lane: 1 })]
    await nextTick()
    for (const rendered of wrapper!.findAllComponents(Note)) {
      expect(rendered.text()).toContain('1個の重複')
      expect(rendered.text()).toContain('音札ノーツ位置が一致していません：HARD')
      expect(rendered.text()).toContain('音札ノートのレーン位置は3である必要があります。')
    }
    await wrapper!.get('input[aria-label="Object表示モード"]').setValue(true)
    const objects = wrapper!.getComponent(ObjectBasedMeasure)
    expect(objects.findAll('[type="warning"]')).toHaveLength(2)
    expect(objects.findAll('[type="error"]')).toHaveLength(2)
    expect(objects.findAll(warningSelector)).toHaveLength(2)
    expect(objects.findAll('.v-icon[color="error"]')).toHaveLength(2)
  })

  it('UndoとRedoによる譜面の置換でも警告を更新する', async () => {
    const data = setup()
    data.history.run({ label: '音札を移動' }, () => { data.chartObject.value.hard[0].position = 2 })
    await nextTick()
    expect(wrapper!.get(warningSelector).attributes('aria-label')).toBe('音札ノーツ位置が一致していません：HARD')
    data.history.undo()
    await nextTick()
    expect(wrapper!.find(warningSelector).exists()).toBe(false)
    data.history.redo()
    await nextTick()
    expect(wrapper!.get(warningSelector).attributes('aria-label')).toBe('音札ノーツ位置が一致していません：HARD')
  })

  it('ファイル読込・バックアップ復元に追従し、警告中も保存できる', async () => {
    const data = setup()
    localStorage.setItem('chart-editor__backup', JSON.stringify(data.chartObject.value))
    const input = wrapper!.findAllComponents(fileInput).find(component => component.props('label') === 'ファイルを選択')!
    input.vm.$emit('update:modelValue', new File(['{}'], 'partial.json'))
    ControlledFileReader.instances[0].complete(JSON.stringify({ easy: [note()] }))
    await nextTick()
    expect(wrapper!.get(warningSelector).attributes('aria-label'))
      .toBe('音札ノーツ位置が一致していません：RAKU、NORMAL、HARD、EXTRA')

    const createObjectURL = vi.fn(() => 'blob:test')
    vi.stubGlobal('URL', class extends URL { static createObjectURL = createObjectURL })
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await clickButton('名前をつけて保存')
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(download).toHaveBeenCalledOnce()
    expect(wrapper!.find(warningSelector).exists()).toBe(true)

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await clickButton('復元')
    expect(wrapper!.find(warningSelector).exists()).toBe(false)
    expect(data.chartObject.value.hard).toHaveLength(1)
  })
})
