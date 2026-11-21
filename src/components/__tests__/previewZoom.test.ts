import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import Preview from '../Preview.vue'
import App from '../../App.vue'
import type { Measure } from '../../types'
import { showSnackbarKey } from '../../composables/injectionKeys'

const goTo = vi.hoisted(() => vi.fn())
vi.mock('vuetify', () => ({
  useGoTo: () => goTo,
  useTheme: () => ({}),
}))

/** Vuetifyのコンテナ要素を単純なdivへ置き換えるスタブ。 */
const layoutStub = defineComponent({
  setup: (_, { slots }) => () => h('div', slots.default?.()),
})

/** チェックボックス／スイッチ操作を再現するスタブ。 */
const checkboxStub = defineComponent({
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

/** 数値入力欄を再現するスタブ。 */
const textFieldStub = defineComponent({
  props: ['label', 'modelValue'],
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('input', {
    'aria-label': props.label,
    value: props.modelValue,
    onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
  }),
})

/** ハイスピード等のスライダーと前後アイコンボタンを再現するスタブ。 */
const sliderStub = defineComponent({
  props: ['modelValue', 'appendIcon', 'prependIcon'],
  emits: ['update:modelValue', 'click:append', 'click:prepend'],
  setup: (props, { emit }) => () => h('div', { class: 'slider-stub' }, [
    props.prependIcon
      ? h('button', {
          type: 'button',
          'aria-label': 'zoom-out',
          onClick: () => emit('click:prepend'),
        }, '-')
      : null,
    h('input', {
      'aria-label': props.appendIcon ? 'beat-height-slider' : 'slider',
      value: props.modelValue,
      onInput: (event: Event) => {
        emit('update:modelValue', Number((event.target as HTMLInputElement).value))
      },
    }),
    props.appendIcon
      ? h('button', {
          type: 'button',
          'aria-label': 'zoom-in',
          onClick: () => emit('click:append'),
        }, '+')
      : null,
  ]),
})

const layoutNames = [
  'v-app', 'v-container', 'v-row', 'v-col', 'v-spacer', 'v-select', 'v-combobox', 'v-alert',
  'v-card', 'v-list', 'v-list-item', 'v-list-item-subtitle', 'v-card-title', 'v-card-text', 'v-divider',
  'v-card-actions', 'v-expansion-panels', 'v-expansion-panel', 'v-expansion-panel-title',
  'v-expansion-panel-text', 'v-icon', 'v-btn-group', 'v-badge', 'v-chip', 'v-dialog',
  'v-file-input', 'v-color-picker', 'v-img', 'v-radio', 'v-radio-group', 'v-snackbar', 'v-tab',
  'v-table', 'v-tabs', 'v-window', 'v-window-item',
]

const stubs = {
  ...Object.fromEntries(layoutNames.map(name => [name, layoutStub])),
  'v-btn': defineComponent({
    props: ['disabled'],
    setup: (props, { slots }) => () => h('button', { disabled: props.disabled }, slots.default?.()),
  }),
  'v-checkbox': checkboxStub,
  'v-switch': checkboxStub,
  'v-text-field': textFieldStub,
  'v-slider': sliderStub,
  'v-menu': defineComponent({
    setup: (_, { slots }) => () => h('div', [
      slots.activator?.({ props: {} }),
      slots.default?.(),
    ]),
  }),
}

/** テスト用の4/4・BPM120の小節配列を生成する。 */
function buildMeasures(count: number, beatHeight: number): Measure[] {
  const measureHeight = beatHeight * 4

  return Array.from({ length: count }, (_, measure) => ({
    measure,
    measureBpm: 120,
    measureBeat: 4,
    measureReachTime: measure * 2000,
    measurePositionBottom: measure * measureHeight,
    measureHeight,
    measureLength: 2000,
  }))
}

describe('ハイスピード変更時の中央小節位置保持', () => {
  const wrappers: ReturnType<typeof mount>[] = []

  beforeEach(() => {
    localStorage.clear()
    goTo.mockClear()
    vi.useFakeTimers()
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

  /**
   * ページスクロールまたは専用スクロール領域の挙動を模したPreviewラッパーを作成する。
   * スクロール上限クランプと非同期スクロールイベント発火まで再現する。
   */
  function setupPreview(contained: boolean, measureCount = 10, initialBeatHeight = 100) {
    const viewportHeight = 800
    let pageScrollY = 0

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: viewportHeight })
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      get: () => pageScrollY,
      set: (value: number) => { pageScrollY = value },
    })

    const wrapper = mount(Preview, {
      attachTo: document.body,
      props: {
        contained,
        layout: contained ? 'stacked' : 'side-by-side',
        beatHeight: initialBeatHeight,
        measureData: buildMeasures(measureCount, initialBeatHeight),
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
      clientWidth: { configurable: true, value: 420 },
      clientHeight: { configurable: true, value: viewportHeight },
    })
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 420, viewportHeight))

    /** 現在の譜面高さに対する最大スクロール量を返す。 */
    const getMaxScroll = () => {
      const last = wrapper.props('measureData')?.at(-1)
      const entireHeight = (last?.measurePositionBottom ?? 0) + (last?.measureHeight ?? 0)

      return Math.max(0, entireHeight - viewportHeight)
    }

    const windowScrollTo = vi.spyOn(window, 'scrollTo').mockImplementation((options?: ScrollToOptions | number) => {
      const top = typeof options === 'number' ? options : (options?.top ?? 0)
      pageScrollY = Math.max(0, Math.min(getMaxScroll(), top))
    })

    const containerScrollTo = vi.fn((options?: ScrollToOptions) => {
      const top = options?.top ?? 0
      viewport.scrollTop = Math.max(0, Math.min(getMaxScroll(), top))
    })
    Object.assign(viewport, { scrollTo: containerScrollTo })

    vi.spyOn(wrapper.get('.preview').element, 'getBoundingClientRect').mockImplementation(() => {
      const currentTop = wrapper.props('contained') ? viewport.scrollTop : pageScrollY
      const last = wrapper.props('measureData')?.at(-1)
      const entireHeight = (last?.measurePositionBottom ?? 0) + (last?.measureHeight ?? 0)

      return new DOMRect(0, -currentTop, 420, entireHeight)
    })

    /** 現在のスクロール対象へスクロール位置を設定する。 */
    const setScrollTop = (top: number, emitEvent = false) => {
      if (contained) {
        viewport.scrollTop = top

        if (emitEvent) {
          viewport.dispatchEvent(new Event('scroll'))
        }
      } else {
        pageScrollY = top

        if (emitEvent) {
          window.dispatchEvent(new Event('scroll'))
        }
      }
    }

    /** 現在のスクロール対象からスクロール位置を読む。 */
    const getScrollTop = () => (contained ? viewport.scrollTop : pageScrollY)

    /** ハイスピードを変更し、DOM更新とズーム補正の完了まで待機する。 */
    const setBeatHeight = async (nextBeatHeight: number) => {
      const currentCount = wrapper.props('measureData')?.length ?? measureCount

      await wrapper.setProps({
        beatHeight: nextBeatHeight,
        measureData: buildMeasures(currentCount, nextBeatHeight),
      })
      await nextTick()
    }

    /** ズーム補正直後にブラウザが非同期で発火するscrollイベントを再現する。 */
    const dispatchBrowserScrollEvent = () => {
      if (contained) {
        viewport.dispatchEvent(new Event('scroll'))
      } else {
        window.dispatchEvent(new Event('scroll'))
      }
    }

    const button = (text: string) => wrapper.findAll('.control button').find(b => b.text().endsWith(text))!

    return {
      wrapper,
      viewport,
      windowScrollTo,
      containerScrollTo,
      setScrollTop,
      getScrollTop,
      setBeatHeight,
      dispatchBrowserScrollEvent,
      button,
    }
  }

  it.each([false, true])(
    'ハイスピード拡大縮小で現在の中央小節位置を即時スクロールで維持する（分割=%s）',
    async (contained) => {
      const { setScrollTop, getScrollTop, setBeatHeight, windowScrollTo, containerScrollTo } =
        setupPreview(contained)

      // 全体4000px、viewportHeight=800。scrollTop=2000 の中央は bottom=1600（4小節先頭）
      setScrollTop(2000)

      await setBeatHeight(200)

      const scrollSpy = contained ? containerScrollTo : windowScrollTo
      expect(scrollSpy).toHaveBeenLastCalledWith({ top: 4400, behavior: 'instant' })
      expect(getScrollTop()).toBe(4400)

      await setBeatHeight(50)

      expect(scrollSpy).toHaveBeenLastCalledWith({ top: 800, behavior: 'instant' })
      expect(getScrollTop()).toBe(800)
    },
  )

  it.each([false, true])(
    '連続操作でスクロール上限やbeatHeight=0を経由して戻しても、元の小節位置へ復元する（分割=%s）',
    async (contained) => {
      const { setScrollTop, getScrollTop, setBeatHeight, dispatchBrowserScrollEvent } =
        setupPreview(contained)

      // 初期位置: 4小節先頭が中央（scrollTop=2000）
      setScrollTop(2000)

      // 譜面全体が画面内に収まる倍率（beatHeight=20 -> 全体800px、maxScroll=0）まで縮小
      await setBeatHeight(20)
      expect(getScrollTop()).toBe(0)
      dispatchBrowserScrollEvent()

      // さらに0まで縮小してもアンカーを保持する
      await setBeatHeight(0)
      expect(getScrollTop()).toBe(0)
      dispatchBrowserScrollEvent()

      // 再び200へ拡大すると、元の4小節先頭（scrollTop=4400）へ戻る
      await setBeatHeight(200)
      expect(getScrollTop()).toBe(4400)
    },
  )

  it.each([false, true])(
    '手動スクロール後は記憶していた基準位置を破棄し、新しい中央位置で拡大縮小する（分割=%s）',
    async (contained) => {
      const { setScrollTop, getScrollTop, setBeatHeight, dispatchBrowserScrollEvent } =
        setupPreview(contained)

      // 4小節先頭（scrollTop=2000）で一度拡大する（scrollTop=4400）
      setScrollTop(2000)
      await setBeatHeight(200)
      expect(getScrollTop()).toBe(4400)
      dispatchBrowserScrollEvent()

      // ユーザーが手動で8小節先頭が中央になる位置へスクロール（全体8000、bottom=6400 -> scrollTop=1200）
      setScrollTop(1200, true)

      // 100へ戻すと、古い4小節ではなく8小節先頭（全体4000、bottom=3200 -> scrollTop=400）を維持する
      await setBeatHeight(100)
      expect(getScrollTop()).toBe(400)
    },
  )

  it('小節ジャンプや譜面構造変更で記憶していた基準位置を破棄する', async () => {
    const { wrapper, setScrollTop, getScrollTop, setBeatHeight } = setupPreview(true)

    setScrollTop(2000)
    await setBeatHeight(200)
    expect(getScrollTop()).toBe(4400)

    // 小節ジャンプ後に位置が変わり、その後に縮小すると新しい位置を基準にする
    wrapper.vm.scrollToMeasure(8)
    setScrollTop(1200)
    await setBeatHeight(100)
    expect(getScrollTop()).toBe(400)

    // beatHeightを変えずにmeasureDataだけ更新（小節追加など）した場合もアンカーを破棄する
    await wrapper.setProps({ measureData: buildMeasures(12, 100) })
    await nextTick()
    setScrollTop(800) // 全体4800、中央bottom=3600（9小節先頭）
    await setBeatHeight(200) // 全体9600、9小節先頭はbottom=7200 -> scrollTop=2000
    expect(getScrollTop()).toBe(2000)
  })

  it('Object表示モードではハイスピードを変更してもスクロール位置を変えない', async () => {
    const { wrapper, setScrollTop, setBeatHeight, containerScrollTo } = setupPreview(true)

    await wrapper.get('input[aria-label="Object表示モード"]').setValue(true)
    setScrollTop(300)
    containerScrollTo.mockClear()

    await setBeatHeight(200)

    expect(containerScrollTo).not.toHaveBeenCalled()
  })

  it.each([false, true])(
    '再生中にハイスピードを変更しても再生を継続し、停止時は新しい倍率の同じ中央小節へ戻る（分割=%s）',
    async (contained) => {
      const {
        wrapper,
        setScrollTop,
        setBeatHeight,
        windowScrollTo,
        containerScrollTo,
        button,
      } = setupPreview(contained)

      // 再生開始前: 4小節先頭が中央（scrollTop=2000）
      setScrollTop(2000)

      await button('再生').trigger('click')
      expect(wrapper.vm.isPlaying).toBe(true)

      const scrollSpy = contained ? containerScrollTo : windowScrollTo
      scrollSpy.mockClear()

      // 再生中に0を経由して200へ変更しても、再生中はスクロールしない
      await setBeatHeight(0)
      await setBeatHeight(200)

      expect(wrapper.vm.isPlaying).toBe(true)
      expect(scrollSpy).not.toHaveBeenCalled()

      // 停止すると、200倍率での4小節先頭中央位置（scrollTop=4400）へ復帰する
      await button('停止').trigger('click')
      await vi.advanceTimersByTimeAsync(50)

      expect(wrapper.vm.isPlaying).toBe(false)
      expect(scrollSpy).toHaveBeenLastCalledWith({ top: 4400, behavior: 'auto' })
    },
  )

  it('Appのハイスピードスライダーと＋／－ボタン操作で中央小節位置を保ったまま拡大縮小する', async () => {
    const viewportHeight = 800
    let pageScrollY = 0

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: viewportHeight })
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      get: () => pageScrollY,
      set: (value: number) => { pageScrollY = value },
    })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })

    const windowScrollTo = vi.spyOn(window, 'scrollTo').mockImplementation((options?: ScrollToOptions | number) => {
      const top = typeof options === 'number' ? options : (options?.top ?? 0)
      pageScrollY = Math.max(0, top)
    })

    // 10小節ある譜面をバックアップ経由で初期表示するため、Appマウント後に小節高さを確認する
    localStorage.setItem('chart-editor__beat-height', '100')
    localStorage.setItem('chart-editor__backup', JSON.stringify({
      raku: [],
      easy: [{ index: 0, type: 1, lane: 1, measure: 9, position: 0, split: 4, option: [], end: [] }],
      normal: [],
      hard: [],
      extra: [],
      info: { version: 2, offset: 0, bpm: 120, beat: 4 },
    }))

    const wrapper = mount(App, {
      attachTo: document.body,
      global: {
        stubs: {
          ...stubs,
          MeasureComponent: true,
          LongNote: true,
          NoteShadow: true,
          EndForm: true,
          DensityGraph: true,
          ThemeToggle: true,
        },
      },
    })
    wrappers.push(wrapper)

    // バックアップから復元して0〜9小節（全体4000px）の譜面を作る
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const restoreButton = wrapper.findAll('button').find(b => b.text().trim() === '復元')!
    await restoreButton.trigger('click')
    await nextTick()

    vi.spyOn(wrapper.get('.preview').element, 'getBoundingClientRect').mockImplementation(() => {
      return new DOMRect(0, -pageScrollY, 420, 4000)
    })

    // 4小節先頭が中央の位置（scrollTop=2000）へ移動する
    pageScrollY = 2000

    // ＋ボタンで beatHeight: 100 -> 110（全体4400、4小節先頭はbottom=1760 -> scrollTop=2240）
    await wrapper.get('button[aria-label="zoom-in"]').trigger('click')
    await nextTick()
    expect(windowScrollTo).toHaveBeenLastCalledWith({ top: 2240, behavior: 'instant' })
    expect(pageScrollY).toBe(2240)

    // スライダーで beatHeight: 110 -> 200（全体8000、4小節先頭はbottom=3200 -> scrollTop=4400）
    await wrapper.get('input[aria-label="beat-height-slider"]').setValue('200')
    await nextTick()
    expect(windowScrollTo).toHaveBeenLastCalledWith({ top: 4400, behavior: 'instant' })
    expect(pageScrollY).toBe(4400)

    // －ボタンで beatHeight: 200 -> 190（全体7600、4小節先頭はbottom=3040 -> scrollTop=4160）
    await wrapper.get('button[aria-label="zoom-out"]').trigger('click')
    await nextTick()
    expect(windowScrollTo).toHaveBeenLastCalledWith({ top: 4160, behavior: 'instant' })
    expect(pageScrollY).toBe(4160)
  })
})
