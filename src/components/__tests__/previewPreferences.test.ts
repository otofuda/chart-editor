import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import App from '../../App.vue'
import Preview from '../Preview.vue'
import { showSnackbarKey } from '../../composables/injectionKeys'
import { useChartData } from '../../composables/useChartData'
import { useFileIO } from '../../composables/useFileIO'

vi.mock('vuetify', () => ({
  useGoTo: () => () => {},
  useTheme: () => ({}),
}))

// Vuetify の見た目を簡易な要素に置き換え、設定の入出力を確認する。
const layout = defineComponent({
  setup: (_, { slots }) => () => h('div', slots.default?.()),
})
const checkbox = defineComponent({
  props: ['label', 'modelValue', 'disabled'],
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('input', {
    type: 'checkbox',
    'aria-label': props.label,
    checked: props.modelValue,
    disabled: props.disabled,
    onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).checked),
  }),
})
const textField = defineComponent({
  props: ['label', 'modelValue'],
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('input', {
    'aria-label': props.label,
    value: props.modelValue,
    onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
  }),
})
const slider = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('input', {
    'aria-label': 'slider',
    value: props.modelValue,
    onInput: (event: Event) => {
      emit('update:modelValue', Number((event.target as HTMLInputElement).value))
    },
  }),
})
const layouts = [
  'v-app', 'v-container', 'v-row', 'v-col', 'v-spacer', 'v-select', 'v-combobox', 'v-alert',
  'v-card', 'v-list', 'v-list-item', 'v-list-item-subtitle', 'v-card-title', 'v-card-text', 'v-divider',
  'v-card-actions', 'v-expansion-panels', 'v-expansion-panel', 'v-expansion-panel-title',
  'v-expansion-panel-text', 'v-icon', 'v-btn', 'v-btn-group', 'v-badge', 'v-chip', 'v-dialog',
  'v-file-input', 'v-color-picker', 'v-img', 'v-radio', 'v-radio-group', 'v-snackbar', 'v-tab',
  'v-table', 'v-tabs', 'v-window', 'v-window-item',
]
const stubs = {
  ...Object.fromEntries(layouts.map(name => [name, layout])),
  'v-checkbox': checkbox,
  'v-switch': checkbox,
  'v-text-field': textField,
  'v-slider': slider,
  'v-menu': defineComponent({
    setup: (_, { slots }) => () => h('div', [
      slots.activator?.({ props: {} }),
      slots.default?.(),
    ]),
  }),
}

const previewCheckboxes = [
  'チェックボックスを表示', '打鍵音を再生 (β)', 'LN終点音を再生 (α)',
  'キービームとコンボを表示', 'フリックエフェクト (β)',
  'LeapMotion補助線をシミュレート (α)', 'LED制御をシミュレート (β)',
  '小節ガイド音を再生', 'Object表示モード',
]

function input(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.get(`input[aria-label="${label}"]`)
}

describe('プレビュー設定の永続化', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ contents: [] }) }))
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('表示とサウンド・詳細設定・音量を再生成後も表示と音声に反映する', async () => {
    const io = useFileIO(useChartData(), vi.fn())
    io.audioVolume.value = 35
    const makePreview = () => mount(Preview, {
      props: {
        infoObject: { bpm: 120, beat: 4, offset: 0, version: 2 },
        audioVolume: useFileIO(useChartData(), vi.fn()).audioVolume.value,
        previewAudio: new Audio(),
      },
      global: {
        stubs: {
          ...stubs,
          MeasureComponent: true,
          ObjectBasedMeasure: true,
          LongNote: true,
          NoteShadow: true,
        },
        provide: { [showSnackbarKey as symbol]: vi.fn() },
      },
    })
    let wrapper = makePreview()
    for (const label of previewCheckboxes) {
      await input(wrapper, label).setValue(true)
    }
    await input(wrapper, 'コンボ表示位置').setValue('90')
    await input(wrapper, '判定位置調整(β)').setValue('-12')
    await input(wrapper, 'キービームの長さ').setValue('120')
    await input(wrapper, 'slider').setValue('0')
    await input(wrapper, 'キービームとコンボを表示').setValue(false)
    expect((input(wrapper, 'フリックエフェクト (β)').element as HTMLInputElement).disabled).toBe(true)
    wrapper.unmount()

    wrapper = makePreview()
    for (const label of previewCheckboxes.filter(label => label !== 'キービームとコンボを表示')) {
      expect((input(wrapper, label).element as HTMLInputElement).checked).toBe(true)
    }
    expect((input(wrapper, 'フリックエフェクト (β)').element as HTMLInputElement).disabled).toBe(true)
    expect((input(wrapper, 'コンボ表示位置').element as HTMLInputElement).value).toBe('90')
    expect((input(wrapper, '判定位置調整(β)').element as HTMLInputElement).value).toBe('-12')
    expect((input(wrapper, 'キービームの長さ').element as HTMLInputElement).value).toBe('120')
    expect((input(wrapper, 'slider').element as HTMLInputElement).value).toBe('0')
    expect(wrapper.props('previewAudio')!.volume).toBe(0.35)
    expect(wrapper.find('.object-based-preview').exists()).toBe(true)
    await input(wrapper, 'Object表示モード').setValue(false)
    expect(wrapper.get('.preview').attributes('style')).toContain('translateY(-12px)')
    wrapper.unmount()
  })

  it('プレビュー表示モードを復元し、無効化された子項目も保持する', async () => {
    const makeApp = () => mount(App, {
      global: {
        stubs: { ...stubs, Preview: true, EndForm: true, DensityGraph: true, ThemeToggle: true },
      },
    })
    let wrapper = makeApp()
    await input(wrapper, 'ノーツ詳細を表示').setValue(true)
    await input(wrapper, 'キャプチャ用モード').setValue(true)
    await input(wrapper, '譜面プレビュー用').setValue(true)
    await input(wrapper, '譜面停止をシミュレート').setValue(true)
    await input(wrapper, 'ノーツ詳細を表示').setValue(false)
    wrapper.unmount()

    wrapper = makeApp()
    expect((input(wrapper, 'ノーツ詳細を表示').element as HTMLInputElement).checked).toBe(false)
    expect((input(wrapper, 'キャプチャ用モード').element as HTMLInputElement).checked).toBe(true)
    expect((input(wrapper, 'キャプチャ用モード').element as HTMLInputElement).disabled).toBe(true)
    expect((input(wrapper, '譜面プレビュー用').element as HTMLInputElement).checked).toBe(true)
    expect((input(wrapper, '譜面停止をシミュレート').element as HTMLInputElement).checked).toBe(true)
    const chart = useChartData()
    chart.chartObject.value.easy = [
      { index: 1, type: 92, lane: -1, measure: 0, position: 0, split: 4, option: [], end: [] },
    ]
    expect(chart.measureData.value[0].measureHeight).toBe(0)
    await input(wrapper, 'ノーツ詳細を表示').setValue(true)
    await input(wrapper, '譜面プレビュー用').setValue(false)
    await input(wrapper, '譜面画像生成用').setValue(true)
    wrapper.unmount()

    wrapper = makeApp()
    expect((input(wrapper, '譜面画像生成用').element as HTMLInputElement).checked).toBe(true)
    expect((input(wrapper, '譜面プレビュー用').element as HTMLInputElement).disabled).toBe(true)
    wrapper.unmount()
  })
})
