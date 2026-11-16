import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { VBtn } from 'vuetify/components/VBtn'
import { VBtnGroup } from 'vuetify/components/VBtnGroup'
import App from '../../App.vue'
import Preview from '../Preview.vue'
import { showSnackbarKey } from '../../composables/injectionKeys'
import { useChartData } from '../../composables/useChartData'
import { useFileIO } from '../../composables/useFileIO'

const goTo = vi.hoisted(() => vi.fn())
vi.mock('vuetify', () => ({
  useGoTo: () => goTo,
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
  'v-btn': defineComponent({
    props: ['disabled'],
    setup: (props, { slots }) => () => h('button', { disabled: props.disabled }, slots.default?.()),
  }),
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
  '小節ガイド音を再生', 'ノーツ個別の speed・orbit を再現', 'Object表示モード',
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

// CSSの寸法ではなく、実際のスクロール対象・DOM移動・再生状態の連携を確認する。
describe('分割レイアウトのプレビュー操作', () => {
  const wrappers: ReturnType<typeof mount>[] = []
  const measures = [0, 1, 2].map(measure => ({
    measure, measureHeight: 400, measurePositionBottom: measure * 400,
    measureBpm: 120, measureBeat: 4, measureLength: 2000, measureReachTime: measure * 2000,
  }))
  beforeEach(() => {
    localStorage.clear()
    goTo.mockClear()
    vi.useFakeTimers()
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.stubGlobal('scrollY', 0)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ contents: [] }) }))
  })
  afterEach(() => {
    wrappers.splice(0).forEach(wrapper => wrapper.unmount())
    document.body.innerHTML = ''
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function makePreview(contained = true) {
    const wrapper = mount(Preview, {
      attachTo: document.body,
      props: {
        contained, layout: contained ? 'stacked' : 'side-by-side',
        measureData: measures,
        infoObject: { bpm: 120, beat: 4, offset: 0, version: 2 },
      },
      global: {
        stubs: { ...stubs, MeasureComponent: true, LongNote: true, NoteShadow: true },
        provide: { [showSnackbarKey as symbol]: vi.fn() },
      },
    })
    wrappers.push(wrapper)
    const viewport = wrapper.get('.preview-scroll').element as HTMLElement
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 375 },
      clientHeight: { configurable: true, value: 400 },
    })
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 375, 400))
    const scrollTo = vi.fn((options: ScrollToOptions) => { viewport.scrollTop = options.top ?? 0 })
    Object.assign(viewport, { scrollTo })
    vi.spyOn(wrapper.get('.preview').element, 'getBoundingClientRect').mockImplementation(() =>
      new DOMRect(0, -(wrapper.props('contained') ? viewport.scrollTop : window.scrollY), 420, 1200))
    const button = (text: string) => wrapper.findAll('.control button').find(button => button.text().endsWith(text))!
    return { wrapper, viewport, scrollTo, button }
  }

  it.each([false, true])('小節ジャンプの対象を実際のスクロール領域に合わせる（分割=%s）', contained => {
    const { wrapper, viewport } = makePreview(contained)
    wrapper.vm.scrollToMeasure(1)
    expect(goTo).toHaveBeenLastCalledWith(400, { container: contained ? viewport : undefined })
  })

  it('再生を上側領域で開始し、停止後は譜面領域の位置を復元する', async () => {
    const { wrapper, viewport, scrollTo, button } = makePreview()
    viewport.scrollTop = 345
    await button('再生').trigger('click')
    expect(wrapper.classes()).toContain('playing')
    expect(viewport.scrollTop).toBe(0)
    expect(wrapper.get('.preview').attributes('style')).toContain('position: absolute')
    await button('停止').trigger('click')
    await vi.advanceTimersByTimeAsync(50)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 345, behavior: 'auto' })
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('エフェクトを横スクロール後の譜面位置と領域高に合わせる', async () => {
    const { wrapper, viewport } = makePreview()
    viewport.scrollLeft = 45
    await wrapper.get('.preview-scroll').trigger('scroll')
    expect(wrapper.get('.preview-effects').attributes('style')).toContain('left: -45px')
    expect(wrapper.get('.preview-effects').attributes('style')).toContain('height: 400px')
  })

  it('左右と上下を切り替えても表示中の小節内の位置を引き継ぐ', async () => {
    const { wrapper, viewport, scrollTo } = makePreview()
    viewport.scrollTop = 350
    const toPage = wrapper.vm.prepareLayoutChange('side-by-side')
    await wrapper.setProps({ layout: 'side-by-side', contained: false })
    toPage()
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 350, behavior: 'instant' })
    vi.stubGlobal('scrollY', 350)
    const toPane = wrapper.vm.prepareLayoutChange('stacked')
    await wrapper.setProps({ layout: 'stacked', contained: true })
    toPane()
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 350, behavior: 'instant' })
  })

  it('再生中のレイアウト変更では再生を停止し、再生開始前の位置へ戻す', async () => {
    const { wrapper, viewport, button } = makePreview()
    viewport.scrollTop = 350
    await button('再生').trigger('click')
    const restore = wrapper.vm.prepareLayoutChange('side-by-side')
    await wrapper.setProps({ layout: 'side-by-side', contained: false })
    restore()
    expect(wrapper.classes()).not.toContain('playing')
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 350, behavior: 'instant' })
  })

  it('Object表示では入れ子のノーツを除いた小節へ移動し、切り替え後も同じ小節を表示する', async () => {
    const { wrapper, viewport } = makePreview()
    await input(wrapper, 'Object表示モード').setValue(true)
    const objects = wrapper.findAll('.object-based-preview > .object-based-measure')
    const nested = document.createElement('div')
    nested.className = 'object-based-measure'
    objects[0].element.append(nested)
    vi.spyOn(objects[0].element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, -150, 420, 100))
    vi.spyOn(objects[1].element, 'getBoundingClientRect').mockImplementation(() =>
      new DOMRect(0, wrapper.props('contained') ? -50 : 250, 420, 200))
    viewport.scrollTop = 150
    wrapper.vm.scrollToMeasure(1)
    expect(goTo).toHaveBeenLastCalledWith(100, { container: viewport })
    const restore = wrapper.vm.prepareLayoutChange('side-by-side')
    await wrapper.setProps({ layout: 'side-by-side', contained: false })
    restore()
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 300, behavior: 'instant' })
  })

  it('手動の左右分割で幅の境界をまたぐ場合は再生を継続する', async () => {
    const { wrapper, button } = makePreview(false)
    await button('再生').trigger('click')
    const restore = wrapper.vm.prepareLayoutChange('side-by-side')
    await wrapper.setProps({ contained: true })
    restore()
    await nextTick()
    expect(wrapper.classes()).toContain('playing')
  })

  it('コントロールを移動しても入力状態とDOMを保持する', async () => {
    const target = document.createElement('div')
    target.id = 'controls-target'
    document.body.append(target)
    const { wrapper } = makePreview(false)
    await wrapper.setProps({ controlsTarget: '#controls-target' })
    const control = wrapper.get('.control').element
    await input(wrapper, '再生開始小節').setValue('2')
    await wrapper.setProps({ layout: 'stacked', contained: true })
    expect(target.querySelector('.control')).toBe(control)
    expect((target.querySelector('input[aria-label="再生開始小節"]') as HTMLInputElement).value).toBe('2')
    await wrapper.setProps({ layout: 'side-by-side', contained: false })
    expect(wrapper.get('.control').element).toBe(control)
  })

  it('レイアウトのボタングループをダークモードの隣に配置し、選択を反映する', async () => {
    const prepare = vi.fn(() => vi.fn())
    const previewStub = defineComponent({
      setup(_, { expose }) {
        expose({ prepareLayoutChange: prepare })
        return () => h('div')
      },
    })
    const wrapper = mount(App, { global: { stubs: {
      ...stubs, Preview: previewStub, ThemeToggle: true, EndForm: true, DensityGraph: true,
    } } })
    wrappers.push(wrapper)
    const group = wrapper.get('[role="group"][aria-label="レイアウト"]')
    expect(group.element.previousElementSibling?.tagName.toLowerCase()).toBe('theme-toggle-stub')
    const button = (text: string) => group.findAll('button').find(button => button.text() === text)!
    expect(button('自動').attributes('aria-pressed')).toBe('true')
    await button('上下').trigger('click')
    expect(wrapper.classes()).toContain('layout-stacked')
    expect(button('上下').attributes('aria-pressed')).toBe('true')
    expect(prepare).toHaveBeenCalledOnce()
    await button('自動').trigger('click')
    expect(wrapper.classes()).not.toContain('layout-stacked')
    expect(button('自動').attributes('aria-pressed')).toBe('true')
  })

  it('実際のVuetifyで共通の角丸設定があっても、各ボタンに角丸のユーティリティを適用しない', async () => {
    const { createVuetify } = await vi.importActual<typeof import('vuetify')>('vuetify')
    const previewStub = defineComponent({
      setup(_, { expose }) {
        expose({ prepareLayoutChange: () => () => {} })
        return () => h('div')
      },
    })
    const wrapper = mount(App, { global: {
      plugins: [createVuetify({ components: { VBtn, VBtnGroup }, defaults: { VBtn: { rounded: 'lg' } } })],
      stubs: {
        ...stubs, 'v-btn': VBtn, 'v-btn-group': VBtnGroup,
        Preview: previewStub, ThemeToggle: true, EndForm: true, DensityGraph: true,
      },
    } })
    wrappers.push(wrapper)
    const group = wrapper.get('.layout-switch')
    expect(group.classes()).toContain('v-btn-group')
    expect(group.classes()).toContain('v-btn-group--divided')
    expect(group.classes()).toContain('rounded-lg')
    const buttons = group.findAll('button')
    expect(buttons.map(button => button.text())).toEqual(['自動', '左右', '上下'])
    for (const button of buttons) {
      expect(button.classes()).not.toContain('rounded-lg')
    }
    await buttons[2].trigger('click')
    expect(buttons[2].attributes('aria-pressed')).toBe('true')
    expect(buttons[0].attributes('aria-pressed')).toBe('false')
  })
})
