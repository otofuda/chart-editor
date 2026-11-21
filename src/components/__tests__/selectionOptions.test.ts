import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import App from '../../App.vue'
import * as chartModule from '../../composables/useChartData'
import type { ExtendedNoteData } from '../../types'

vi.mock('vuetify', () => ({ useGoTo: () => () => {} }))

// 入力・チェック・ボタン・ダイアログの開閉はDOMで操作し、装飾だけ省略する。
const layout = defineComponent({
  setup: (_, { slots }) => () => h('div', slots.default?.()),
})

/** 変更対象のチェック状態を、通常のチェックボックスで操作する。 */
const checkbox = defineComponent({
  props: ['label', 'modelValue', 'disabled'],
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('input', {
    type: 'checkbox',
    'aria-label': props.label,
    checked: props.modelValue,
    disabled: props.disabled,
    onChange: (event: Event) => emit(
      'update:modelValue',
      (event.target as HTMLInputElement).checked
    ),
  }),
})

/** 入力値・無効状態・混在値の説明を、DOM上で検証できる形にする。 */
const textField = defineComponent({
  props: ['label', 'modelValue', 'disabled', 'type', 'placeholder', 'hint'],
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('div', [
    h('input', {
      'aria-label': props.label,
      value: props.modelValue,
      disabled: props.disabled,
      type: props.type,
      placeholder: props.placeholder,
      onInput: (event: Event) => emit(
        'update:modelValue',
        (event.target as HTMLInputElement).value
      ),
    }),
    h('span', props.hint),
  ]),
})

const button = defineComponent({
  props: ['disabled'],
  setup: (props, { slots }) => () => h('button', { disabled: props.disabled }, slots.default?.()),
})

/** 開閉時の初期化を確認するため、ダイアログのv-modelを維持する。 */
const dialog = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  setup: (props, { slots, emit }) => () => props.modelValue ? h('div', [
    h('button', {
      'aria-label': 'ダイアログを閉じる',
      onClick: () => emit('update:modelValue', false),
    }),
    slots.default?.(),
  ]) : null,
})

const layouts = [
  'v-app', 'v-container', 'v-row', 'v-col', 'v-spacer', 'v-select', 'v-combobox', 'v-alert',
  'v-card', 'v-list', 'v-list-item', 'v-list-item-subtitle', 'v-card-title', 'v-card-text', 'v-divider',
  'v-card-actions', 'v-expansion-panels', 'v-expansion-panel', 'v-expansion-panel-title',
  'v-expansion-panel-text', 'v-icon', 'v-btn-group', 'v-badge', 'v-chip', 'v-slider',
  'v-file-input', 'v-color-picker', 'v-img', 'v-radio', 'v-radio-group', 'v-snackbar', 'v-tab',
  'v-table', 'v-tabs', 'v-window', 'v-window-item', 'v-menu',
]

let wrapper: VueWrapper

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ contents: [] }) }))
})

afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** 選択済みのフリックを基準に、各ケースで必要なノーツを生成する。 */
function note(overrides: Partial<ExtendedNoteData> = {}): ExtendedNoteData {
  return {
    type: 3,
    lane: 1,
    measure: 0,
    position: 0,
    split: 4,
    option: [],
    end: [],
    isSelected: true,
    ...overrides,
  }
}

/** 検証用の譜面を画面に接続し、一括操作ダイアログを開く。 */
async function setup(notes: ExtendedNoteData[]) {
  const data = chartModule.useChartData()
  data.chartObject.value.easy = notes
  vi.spyOn(chartModule, 'useChartData').mockReturnValue(data)

  wrapper = mount(App, {
    global: {
      stubs: {
        ...Object.fromEntries(layouts.map(name => [name, layout])),
        'v-checkbox': checkbox,
        'v-switch': checkbox,
        'v-text-field': textField,
        'v-btn': button,
        'v-dialog': dialog,
        Preview: true,
        EndForm: true,
        DensityGraph: true,
        NoteTypePie: true,
        ThemeToggle: true,
        HistoryControls: true,
      },
    },
  })

  await open()
  return data
}

/** 実際の操作ボタンからダイアログを開き、表示更新を待つ。 */
async function open() {
  const openButton = wrapper.findAll('button').find(
    btn => btn.text() === 'ノーツの一括操作'
  )!

  await openButton.trigger('click')
}

/** 他の編集フォームを除き、今回追加した一括変更欄を取得する。 */
function section() {
  return wrapper.get('[data-testid="selection-options"]')
}

function input(label: string) {
  return section().get<HTMLInputElement>(`input[aria-label="${label}"]`)
}

function apply() {
  return section().get<HTMLButtonElement>('button')
}

describe('オプションの一括変更フォーム', () => {
  it.each([
    { notes: [], reason: '1つ以上' },
    { notes: [note(), note({ type: 1 })], reason: '同一' },
    { notes: [note(), note({ type: 4 }), note({ type: 5 })], reason: '同一' },
    { notes: [note({ type: 90, option: ['90'] })], reason: '対象外' },
    { notes: [note({ type: 99 })], reason: 'ありません' },
  ])('無効理由を表示して実行ボタンを無効化する: $reason', async ({ notes, reason }) => {
    await setup(notes)
    expect(section().text()).toContain(reason)
    expect(apply().element.disabled).toBe(true)
    expect(section().findAll('input')).toHaveLength(0)
  })

  it('上下左右フリックをまとめて編集し、混在する方向の変更でもフォームを初期化する', async () => {
    const types = [3, 4, 6, 7]
    const data = await setup(types.map(type => note({
      type,
      option: ['2', '0', '1', '1', '0'],
    })))

    expect(section().findAll('input[type="checkbox"]')).toHaveLength(5)
    await input('widthを変更').setValue(true)
    await input('width').setValue('3')
    await input('orbitを変更').setValue(true)
    await input('orbit').setValue('0.5')
    expect(apply().element.disabled).toBe(false)
    await apply().trigger('click')

    expect(data.currentChart.value.map(n => n.type)).toEqual(types)
    data.currentChart.value.forEach(n => {
      expect(n.option).toEqual(['3', '0', '1', '1', '0.5'])
    })

    // 共通typeがnullのままでも、方向変更前の未確定入力を持ち越さない。
    await input('widthを変更').setValue(true)
    await input('width').setValue('9')
    data.currentChart.value[0].type = 7
    await nextTick()

    expect(input('widthを変更').element.checked).toBe(false)
    expect(input('width').element.value).toBe('3')

    // フリック以外が混ざった場合は、その時点で一括変更を無効にする。
    data.currentChart.value[0].type = 1
    await nextTick()

    expect(section().text()).toContain('同一')
    expect(apply().element.disabled).toBe(true)
  })

  it('共通値と混在値を表示し、チェックした項目だけ変更してチェックを解除する', async () => {
    const data = await setup([
      note({ option: ['2', '1', '4', '1', '0'] }),
      note({ option: ['3', '1', '4', '1', '0'] }),
    ])

    // 初期表示では共通値を保ち、混在値は説明付きの空欄として表示する。
    expect(input('offsetNumer').element.value).toBe('1')
    expect(input('width').element.value).toBe('')
    expect(input('width').attributes('placeholder')).toBe('値が混在')
    expect(section().text()).toContain('値が混在')
    expect(input('width').element.disabled).toBe(true)
    expect(apply().element.disabled).toBe(true)

    // チェックしたwidthとorbitだけに値を入力して適用する。
    await input('widthを変更').setValue(true)
    expect(input('width').element.disabled).toBe(false)
    await input('width').setValue('4')
    await input('orbitを変更').setValue(true)
    await input('orbit').setValue('-0.5')
    await apply().trigger('click')

    expect(data.currentChart.value.map(n => n.option)).toEqual([
      ['4', '1', '4', '1', '-0.5'],
      ['4', '1', '4', '1', '-0.5'],
    ])
    expect(input('widthを変更').element.checked).toBe(false)
    expect(input('width').element.value).toBe('4')
    expect(apply().element.disabled).toBe(true)
    expect(wrapper.text()).toContain('2個のノーツのオプションを一括変更しました')
  })

  it('未指定と空文字を共通の空欄として扱い、チェックした空欄を適用する', async () => {
    const data = await setup([note(), note({ option: [''] })])
    expect(section().text()).not.toContain('値が混在')
    await input('widthを変更').setValue(true)
    await apply().trigger('click')
    expect(data.currentChart.value.map(n => n.option)).toEqual([[''], ['']])
  })

  it('同じtype・同じ件数でも選択対象が入れ替わると入力とチェックを初期化する', async () => {
    const data = await setup([
      note({ option: ['2'] }),
      note({ option: ['3'], isSelected: false }),
    ])

    await input('widthを変更').setValue(true)
    await input('width').setValue('9')

    data.currentChart.value[0].isSelected = false
    data.currentChart.value[1].isSelected = true
    await nextTick()

    expect(input('widthを変更').element.checked).toBe(false)
    expect(input('width').element.value).toBe('3')
  })

  it('type変更・難易度変更・ダイアログ再表示で初期化する', async () => {
    const data = await setup([note({ option: ['2'] })])

    // 項目の並びが同じ左右フリック間でも、入力内容を持ち越さない。
    await input('widthを変更').setValue(true)
    await input('width').setValue('9')
    data.currentChart.value[0].type = 4
    await nextTick()
    expect(input('widthを変更').element.checked).toBe(false)
    expect(input('width').element.value).toBe('2')

    // 項目の並びが変わる場合は、新しいtypeの定義でフォームを作り直す。
    await input('widthを変更').setValue(true)
    data.currentChart.value[0].type = 98
    await nextTick()
    expect(input('bpmを変更').element.checked).toBe(false)
    expect(input('bpm').element.value).toBe('2')

    // 別の難易度へ切り替えた場合は、切り替え先の共通値を読み直す。
    data.chartObject.value.hard = [note({ type: 98, option: ['150'] })]
    await input('bpmを変更').setValue(true)
    data.currentDifficulty.value = 'hard'
    await nextTick()
    expect(input('bpmを変更').element.checked).toBe(false)
    expect(input('bpm').element.value).toBe('150')

    // 閉じる前の未確定入力は、ダイアログを開き直した時点で破棄する。
    await input('bpmを変更').setValue(true)
    await input('bpm').setValue('180')
    await wrapper.get('button[aria-label="ダイアログを閉じる"]').trigger('click')
    await open()
    expect(input('bpmを変更').element.checked).toBe(false)
    expect(input('bpm').element.value).toBe('150')
  })

  it('コメントは文字列入力として表示して変更する', async () => {
    const data = await setup([note({ type: 100, option: ['before'] })])
    expect(input('comment').attributes('type')).toBe('text')
    await input('commentを変更').setValue(true)
    await input('comment').setValue('after')
    await apply().trigger('click')
    expect(data.currentChart.value[0].option).toEqual(['after'])
  })
})
