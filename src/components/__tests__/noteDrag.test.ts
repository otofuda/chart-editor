import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { ExtendedNoteData, Measure } from '@/types'
import {
  appendNotesKey,
  cancelNoteKey,
  copyNotesToDifficultyKey,
  deleteNotesKey,
  getMovedNoteKey,
  setAppendNoteInfoKey,
  showSnackbarKey,
  chartHistoryKey,
} from '@/composables/injectionKeys'
import Preview from '../Preview.vue'
import Note from '../Note.vue'
import LongNote from '../LongNote.vue'
import NoteShadow from '../NoteShadow.vue'
import { useChartData } from '@/composables/useChartData'
import { useNoteEditor } from '@/composables/useNoteEditor'
import { useEditorShortcuts } from '@/composables/useEditorShortcuts'

vi.mock('vuetify', () => ({ useGoTo: () => vi.fn() }))

/** テストごとの差分だけを指定して、画面に配置するノーツを作る。 */
function note(overrides: Partial<ExtendedNoteData> = {}): ExtendedNoteData {
  return {
    index: 1,
    type: 1,
    lane: 2,
    measure: 0,
    position: 1,
    split: 4,
    option: [],
    end: [],
    ...overrides,
  }
}

const measures: Measure[] = [0, 1, 2].map(measure => ({
  measure,
  measureHeight: 400,
  measurePositionBottom: measure * 400,
  measureBpm: 120,
  measureBeat: 4,
  measureLength: 2000,
  measureReachTime: measure * 2000,
}))

const layout = defineComponent({
  setup: (_, { slots }) => () => h('div', slots.default?.()),
})

const input = defineComponent({
  props: ['modelValue', 'label'],
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('input', {
    'aria-label': props.label,
    value: props.modelValue,
    onInput: (event: Event) => emit(
      'update:modelValue',
      (event.target as HTMLInputElement).value,
    ),
  }),
})

const toggle = defineComponent({
  props: ['modelValue', 'label'],
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('input', {
    type: 'checkbox',
    'aria-label': props.label,
    checked: props.modelValue,
    onChange: (event: Event) => emit(
      'update:modelValue',
      (event.target as HTMLInputElement).checked,
    ),
  }),
})

const menu = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  setup: (props, { emit, slots }) => () => h('div', [
    slots.activator?.({
      props: {
        role: 'button',
        onClick: () => emit('update:modelValue', !props.modelValue),
      },
    }),
    slots.default?.(),
  ]),
})

const stubs = {
  ...Object.fromEntries([
    'v-row', 'v-col', 'v-spacer', 'v-select', 'v-combobox', 'v-alert', 'v-tooltip',
    'v-card', 'v-card-text', 'v-list', 'v-list-item',
    'v-list-item-title', 'v-card-title', 'v-divider', 'v-card-actions',
    'v-expansion-panels', 'v-expansion-panel', 'v-expansion-panel-title', 'v-expansion-panel-text',
    'v-icon', 'v-slider', 'v-radio-group', 'v-radio',
  ].map(name => [name, layout])),
  'v-text-field': input,
  'v-textarea': input,
  'v-checkbox': toggle,
  'v-switch': toggle,
  'v-btn': defineComponent({
    setup: (_, { slots }) => () => h('button', slots.default?.()),
  }),
  'v-menu': menu,
}

/**
 * マウス・タッチ共通のポインターイベントを、指定した対象へ送出する。
 *
 * @param target イベントを受け取るノーツ要素、譜面、またはウィンドウ
 * @param type pointerdown などのイベント名
 * @param x ビューポート内の横座標
 * @param y ビューポート内の縦座標
 * @param extras ポインター種別や識別子など、テストごとに上書きする属性
 */
function pointer(
  target: EventTarget,
  type: string,
  x: number,
  y: number,
  extras: Record<string, unknown> = {},
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
  })

  Object.defineProperties(
    event,
    Object.fromEntries(Object.entries({
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      ...extras,
    }).map(([key, value]) => [key, { value }])),
  )

  target.dispatchEvent(event)
  return event
}

/** 標準スクロールをキャンセルできたか確認するため、指の移動イベントを送出する。 */
function touchMove(target: EventTarget): Event {
  const event = new Event('touchmove', { bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

let wrappers: VueWrapper[] = []
let frames: Map<number, FrameRequestCallback>
let frameId: number

/** 譜面プレビューを描画し、ポインター捕捉とスクロールを制御できる検証環境を作る。 */
function setup(
  sources: ExtendedNoteData[] = [note()],
  extraProps: Record<string, unknown> = {},
) {
  const data = useChartData()
  data.chartObject.value.easy = sources
  const chart = data.currentChart
  const showSnackbar = vi.fn()
  const cancelNote = vi.fn()
  const previewProps = reactive(extraProps)
  const host = defineComponent({
    setup: () => () => h(Preview, {
      currentChart: chart.value,
      currentDifficulty: 'easy',
      measureData: measures,
      infoObject: { bpm: 120, beat: 4, offset: 0, version: 2 },
      placementSplit: 8,
      ...previewProps,
    }),
  })
  const wrapper = mount(host, {
    attachTo: document.body,
    global: {
      stubs,
      provide: {
        [appendNotesKey as symbol]: vi.fn(),
        [cancelNoteKey as symbol]: cancelNote,
        [copyNotesToDifficultyKey as symbol]: vi.fn(),
        [showSnackbarKey as symbol]: showSnackbar,
        [deleteNotesKey as symbol]: vi.fn(),
        [getMovedNoteKey as symbol]: vi.fn(),
        [setAppendNoteInfoKey as symbol]: vi.fn(),
        [chartHistoryKey as symbol]: data.history,
      },
    },
  })

  wrappers.push(wrapper)
  const content = wrapper.get('.preview-content').element as HTMLElement
  const viewport = wrapper.get('.preview-scroll').element as HTMLElement
  let scroll = 0

  vi.spyOn(content, 'getBoundingClientRect').mockImplementation(() => ({
    x: 100,
    y: -scroll,
    left: 100 - viewport.scrollLeft,
    right: 520 - viewport.scrollLeft,
    top: -scroll,
    bottom: 1200 - scroll,
    width: 420,
    height: 1200,
    toJSON: () => ({}),
  }))

  const capture = vi.fn()
  const release = vi.fn()

  Object.assign(content, {
    setPointerCapture: capture,
    hasPointerCapture: () => capture.mock.calls.length > 0,
    releasePointerCapture: release,
  })

  const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation((x: number | ScrollToOptions) => {
    if (typeof x === 'object') {
      scroll += x.top ?? 0
    }
  })
  const bar = () => wrapper.findComponent(Note).get('.note')

  return {
    wrapper,
    chart,
    data,
    previewProps,
    cancelNote,
    history: data.history,
    content,
    bar,
    showSnackbar,
    capture,
    release,
    scrollBy,
    viewport,
  }
}

beforeEach(() => {
  localStorage.clear()
  frameId = 0
  frames = new Map()
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    frames.set(++frameId, callback)
    return frameId
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
})

/** 配置欄用のシャドーだけを取得し、表示専用の移動候補や仮配置済みノーツと区別する。 */
function placementShadow(wrapper: VueWrapper) {
  return wrapper.findAllComponents(NoteShadow)
    .find(component => component.props('isDraggable') === true)!
}

describe('ドラッグと共通ショートカットの優先順位', () => {
  it('押下直後から新規操作を抑止し、Shiftを押しながらのEscでも中断だけを行う', () => {
    const { wrapper, chart, bar } = setup([note({ isSelected: true })])
    const preview = wrapper.getComponent(Preview)
    const selectAll = vi.fn()
    const escape = vi.fn()
    const togglePlayback = vi.fn()
    const host = mount(defineComponent({
      /** 譜面側のドラッグ状態を参照する、アプリ共通ショートカットを登録する。 */
      setup() {
        useEditorShortcuts({
          selectAll,
          escape,
          togglePlayback,
        }, {
          isDragging: () => preview.vm.isDragging,
        })

        return () => h('div')
      },
    }))

    wrappers.push(host)

    /**
     * windowのドラッグ処理を経由して、documentの共通処理までキーを伝える。
     *
     * @param key 押すキーの名前
     * @param init 修飾キーや長押しなどのイベント属性
     * @returns ドラッグ側で消費されたかを確認するためのイベント
     */
    const key = (key: string, init: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })

      document.body.dispatchEvent(event)

      return event
    }

    // 移動し始める前のポインター押下中から、別の編集操作を抑止する。
    pointer(bar().element, 'pointerdown', 250, 600)
    expect(preview.vm.isDragging).toBe(true)

    key('a', { ctrlKey: true })
    key(' ')

    expect(selectAll).not.toHaveBeenCalled()
    expect(togglePlayback).not.toHaveBeenCalled()

    pointer(window, 'pointermove', 310, 550)

    // 表示中のメニューへEscを譲り、その次のEscではドラッグだけを中断する。
    const overlay = document.createElement('div')
    overlay.className = 'v-menu v-overlay--active'
    document.body.append(overlay)

    expect(key('Escape').defaultPrevented).toBe(false)
    expect(preview.vm.isDragging).toBe(true)

    overlay.remove()

    expect(key('Escape', { shiftKey: true }).defaultPrevented).toBe(true)
    expect(preview.vm.isDragging).toBe(false)
    expect(escape).not.toHaveBeenCalled()
    expect(chart.value[0]).toMatchObject({ lane: 2, position: 1, isSelected: true })

    // 長押しでは選択解除まで進まず、次の独立した押下から共通操作を受け付ける。
    key('Escape', { repeat: true })
    expect(escape).not.toHaveBeenCalled()

    key('Escape')
    expect(escape).toHaveBeenCalledOnce()

    key('a', { ctrlKey: true })
    expect(selectAll).toHaveBeenCalledOnce()
  })
})

describe('配置欄のシャドーのドラッグ操作', () => {
  it.each(['mouse', 'touch'])('%s で配置欄の位置だけを確定し、その位置で仮配置できる', async pointerType => {
    const draft = ref(note({ isSelected: true }))
    const { wrapper, chart, data, history, cancelNote } = setup(
      [note({ index: 9, isSelected: true })],
      { appendNote: draft.value },
    )
    const before = JSON.stringify(chart.value)
    const source = placementShadow(wrapper).get('.note').element

    pointer(source, 'pointerdown', 250, 600, { pointerType })
    if (pointerType === 'touch') {
      expect(touchMove(source).defaultPrevented).toBe(true)
    }
    pointer(window, 'pointermove', 310, 550, { pointerType })
    await nextTick()

    expect(draft.value).toMatchObject({ lane: 2, position: 1, split: 4 })
    const candidate = wrapper.get('.note-drag-preview').getComponent(NoteShadow)
    expect(candidate.props('note')).toMatchObject({ lane: 3, position: 3, split: 8 })
    expect(candidate.props('isDraggable')).toBe(false)

    pointer(window, 'pointerup', 310, 550, { pointerType })
    await nextTick()
    expect(draft.value).toMatchObject({ lane: 3, position: 3, split: 8 })
    expect(JSON.stringify(chart.value)).toBe(before)
    expect(history.entries.value).toHaveLength(0)
    expect(cancelNote).not.toHaveBeenCalled()

    const editor = useNoteEditor(data, vi.fn(), vi.fn())
    editor.appendNote.value = draft.value
    editor.placeNotes(editor.appendNote.value)
    expect(editor.preAppendNotes.value).toHaveLength(1)
    expect(editor.preAppendNotes.value[0]).toMatchObject({ lane: 3, position: 3, split: 8 })
    expect(JSON.stringify(chart.value)).toBe(before)
  })

  it.each([5, 90])('音札と音札ダミーの配置前シャドー type %s はレーン3固定で縦に移動する', async type => {
    const draft = ref(note({ type, lane: 1, option: type === 90 ? ['5'] : [] }))
    const { wrapper, history } = setup([], { appendNote: draft.value })

    pointer(placementShadow(wrapper).get('.note').element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 550)
    await nextTick()
    expect(wrapper.get('.note-drag-preview').getComponent(NoteShadow).props('note'))
      .toMatchObject({ lane: 3, position: 3, split: 8 })
    pointer(window, 'pointerup', 310, 550)
    expect(draft.value).toMatchObject({ lane: 3, position: 3, split: 8 })
    expect(history.entries.value).toHaveLength(0)
  })

  it('split トグルを使い、横だけの移動では配置欄の時刻を変えない', async () => {
    const draft = ref(note({ split: 12, position: 1 }))
    const { wrapper } = setup([], { appendNote: draft.value })
    const source = placementShadow(wrapper).get('.note').element

    pointer(source, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 600)
    pointer(window, 'pointerup', 310, 600)
    expect(draft.value).toMatchObject({ lane: 3, position: 1, split: 12 })

    await wrapper.get('input[aria-label="ドラッグ移動で各ノーツの split を使う"]').setValue(true)
    pointer(source, 'pointerdown', 310, 600)
    pointer(window, 'pointermove', 310, 535)
    pointer(window, 'pointerup', 310, 535)
    expect(draft.value).toMatchObject({ lane: 3, position: 3, split: 12 })
  })

  it('Shift の押下でシャドーの候補を切り替え、配置欄だけに確定する', async () => {
    const draft = ref(note())
    const { wrapper, chart, history } = setup([], { appendNote: draft.value })

    pointer(placementShadow(wrapper).get('.note').element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 250, 540)
    await nextTick()
    const candidate = () => wrapper.get('.note-drag-preview').getComponent(NoteShadow).props('note')
    expect(candidate()).toMatchObject({ position: 3, split: 8 })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true }))
    await nextTick()
    expect(candidate()).toMatchObject({ position: 2, split: 4 })
    expect(draft.value).toMatchObject({ position: 1, split: 4 })

    pointer(window, 'pointerup', 250, 540, { shiftKey: true })
    expect(draft.value).toMatchObject({ position: 2, split: 4 })
    expect(chart.value).toEqual([])
    expect(history.entries.value).toHaveLength(0)
  })

  it.each([2, 90])('配置前ロング type %s は各点を個別に、帯から分岐全体を移動できる', async type => {
    const draft = ref(note({
      type,
      option: type === 90 ? ['2'] : [],
      end: [
        note({
          type: 89,
          measure: 1,
          lane: 2.5 as ExtendedNoteData['lane'],
          option: ['1', '0', 'ease', '2'],
          end: [note({ measure: 2, lane: 3 })],
        }),
        note({ measure: 1, lane: 4 }),
      ],
    }))
    const { wrapper, history } = setup([], { appendNote: draft.value })
    const shadow = placementShadow(wrapper)

    // 始点だけの移動では、中点・終点を動かさない。
    pointer(shadow.get('.note').element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 550)
    pointer(window, 'pointerup', 310, 550)
    await nextTick()
    expect(draft.value).toMatchObject({ lane: 3, position: 3, split: 8 })
    expect(draft.value.end[0]).toMatchObject({ lane: 2.5, position: 1, split: 4 })

    // 不可視の中点を単独移動し、子や別の分岐には反映しない。
    pointer(shadow.get('.draft-invisible-handle').element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 280, 550)
    pointer(window, 'pointerup', 280, 550)
    await nextTick()
    expect(draft.value.end[0]).toMatchObject({ lane: 3, position: 3, split: 8 })
    expect(draft.value.end[0].end[0]).toMatchObject({ lane: 3, position: 1, split: 4 })
    expect(draft.value.end[1]).toMatchObject({ lane: 4, position: 1, split: 4 })

    // 帯を掴むと、各点の差を保って全体を移動する。
    pointer(shadow.get('.hold-fill').element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 550)
    pointer(window, 'pointerup', 310, 550)
    await nextTick()
    expect(draft.value).toMatchObject({ lane: 4, position: 4, split: 8 })
    expect(draft.value.end[0]).toMatchObject({
      lane: 4,
      position: 4,
      split: 8,
      option: ['1', '0', 'ease', '2'],
    })
    expect(draft.value.end[0].end[0]).toMatchObject({ lane: 4, position: 3, split: 8 })
    expect(draft.value.end[1]).toMatchObject({ lane: 5, position: 3, split: 8 })
    expect(history.entries.value).toHaveLength(0)
  })

  it('タップで不可視点を表示し、ドラッグ後のクリックでは表示を切り替えない', async () => {
    const draft = ref(note({ type: 2, end: [note({ type: 89, measure: 1 })] }))
    const { wrapper, previewProps } = setup([], { appendNote: draft.value })
    const shadow = placementShadow(wrapper)
    const source = shadow.get('.note').element

    expect(shadow.get('.draft-invisible-handle').classes()).not.toContain('touch-visible')
    pointer(source, 'pointerdown', 250, 600, { pointerType: 'touch' })
    pointer(window, 'pointerup', 250, 600, { pointerType: 'touch' })
    await shadow.get('.note').trigger('click')
    expect(shadow.get('.draft-invisible-handle').classes()).toContain('touch-visible')

    const band = shadow.get('.hold-border')
    pointer(band.element, 'pointerdown', 250, 600, { pointerType: 'touch' })
    expect(touchMove(band.element).defaultPrevented).toBe(true)
    pointer(window, 'pointermove', 310, 550, { pointerType: 'touch' })
    pointer(window, 'pointerup', 310, 550, { pointerType: 'touch' })
    await band.trigger('click')
    expect(shadow.get('.draft-invisible-handle').classes()).toContain('touch-visible')

    pointer(band.element, 'pointerdown', 310, 550, { pointerType: 'touch' })
    pointer(window, 'pointerup', 310, 550, { pointerType: 'touch' })
    await band.trigger('click')
    expect(shadow.get('.draft-invisible-handle').classes()).not.toContain('touch-visible')

    pointer(source, 'pointerdown', 250, 600, { pointerType: 'touch' })
    pointer(window, 'pointerup', 250, 600, { pointerType: 'touch' })
    await shadow.get('.note').trigger('click')
    draft.value.type = 1
    await nextTick()
    expect(shadow.find('.draft-invisible-handle').exists()).toBe(false)
    draft.value.type = 2
    await nextTick()
    expect(shadow.get('.draft-invisible-handle').classes()).not.toContain('touch-visible')

    previewProps.appendNote = null
    await nextTick()
    expect(wrapper.find('.draft-shadow').exists()).toBe(false)
  })

  it('ハンドル表示前の不可視点へのタッチは帯として扱い、表示後は個別に動かす', async () => {
    const draft = ref(note({ type: 2, end: [note({ type: 89, measure: 1 })] }))
    const { wrapper } = setup([], { appendNote: draft.value })
    const shadow = placementShadow(wrapper)
    const handle = shadow.get('.draft-invisible-handle')

    pointer(handle.element, 'pointerdown', 250, 600, { pointerType: 'touch' })
    pointer(window, 'pointermove', 310, 550, { pointerType: 'touch' })
    pointer(window, 'pointerup', 310, 550, { pointerType: 'touch' })
    await handle.trigger('click')
    expect(draft.value).toMatchObject({ lane: 3, position: 3, split: 8 })
    expect(draft.value.end[0]).toMatchObject({ lane: 3, position: 3, split: 8 })
    expect(handle.classes()).not.toContain('touch-visible')

    pointer(handle.element, 'pointerdown', 310, 550, { pointerType: 'touch' })
    pointer(window, 'pointerup', 310, 550, { pointerType: 'touch' })
    await handle.trigger('click')
    expect(handle.classes()).toContain('touch-visible')

    pointer(handle.element, 'pointerdown', 310, 550, { pointerType: 'touch' })
    pointer(window, 'pointermove', 370, 500, { pointerType: 'touch' })
    pointer(window, 'pointerup', 370, 500, { pointerType: 'touch' })
    expect(draft.value).toMatchObject({ lane: 3, position: 3, split: 8 })
    expect(draft.value.end[0]).toMatchObject({ lane: 4, position: 4, split: 8 })
  })

  it.each(['Escape', 'pointercancel', 'field', 'replace', 'mode', 'difficulty', 'playback', 'hide'])(
    '%s で候補を破棄し、配置欄へ未確定の位置を反映しない',
    async reason => {
      const draft = ref(note())
      const { wrapper, previewProps } = setup([], { appendNote: draft.value })
      const source = placementShadow(wrapper).get('.note').element

      pointer(source, 'pointerdown', 250, 600, { pointerType: 'touch' })
      pointer(window, 'pointermove', 310, 550, { pointerType: 'touch' })
      if (reason === 'Escape') {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      } else if (reason === 'pointercancel') {
        pointer(window, 'pointercancel', 310, 550, { pointerType: 'touch' })
      } else if (reason === 'field') {
        draft.value.position = 2
      } else if (reason === 'replace') {
        previewProps.appendNote = { ...draft.value }
      } else if (reason === 'mode') {
        previewProps.isShowDetail = true
        previewProps.isCaptureMode = true
      } else if (reason === 'difficulty') {
        previewProps.currentDifficulty = 'hard'
      } else if (reason === 'playback') {
        await wrapper.findAll('button').find(button => button.text().includes('再生'))!.trigger('click')
      } else {
        previewProps.appendNote = null
      }
      await nextTick()
      pointer(window, 'pointerup', 310, 550, { pointerType: 'touch' })
      await nextTick()

      expect(draft.value).toMatchObject({ lane: 2, position: reason === 'field' ? 2 : 1, split: 4 })
      expect(wrapper.find('.note-drag-preview').exists()).toBe(false)
      expect(touchMove(source).defaultPrevented).toBe(false)
    },
  )

  it.each(['lane', 'measure', 'order'])('移動先が %s の制約に反する場合は配置欄を更新しない', async kind => {
    const draft = ref(note(kind === 'measure'
      ? { measure: 2, position: 3 }
      : kind === 'order'
        ? { type: 2, end: [note({ position: 2 })] }
        : { lane: 5 }))
    const { wrapper, showSnackbar } = setup([], { appendNote: draft.value })
    const before = JSON.stringify(draft.value)
    const x = kind === 'lane' ? 310 : 250
    const y = kind === 'lane' ? 550 : 500

    pointer(placementShadow(wrapper).get('.note').element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', x, y)
    await nextTick()
    expect(wrapper.get('.note-drag-preview').classes()).toContain('invalid')
    pointer(window, 'pointerup', x, y)
    expect(JSON.stringify(draft.value)).toBe(before)
    expect(showSnackbar).toHaveBeenCalled()
  })

  it('挿入モードをオフにすると既存ノーツを移動でき、仮配置済みノーツはドラッグしない', async () => {
    const draft = ref(note())
    const staged = ref(note({ index: 2, lane: 4 }))
    const { wrapper, previewProps, chart, bar, cancelNote } = setup([note()], {
      appendNote: draft.value,
      preAppendNotes: [staged.value],
    })
    const placed = wrapper.findAllComponents(NoteShadow)
      .find(component => component.props('isPreAppend'))!

    pointer(placed.get('.note').element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 550)
    pointer(window, 'pointerup', 310, 550)
    expect(staged.value).toMatchObject({ lane: 4, position: 1, split: 4 })
    await placed.get('.note').trigger('click')
    expect(cancelNote).toHaveBeenCalledWith(2)

    previewProps.appendNote = null
    await nextTick()
    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 550)
    pointer(window, 'pointerup', 310, 550)
    expect(chart.value[0]).toMatchObject({ lane: 3, position: 3, split: 8 })
    expect(draft.value).toMatchObject({ lane: 2, position: 1, split: 4 })
  })
})

afterEach(() => {
  wrappers.forEach(w => w.unmount())
  wrappers = []
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('譜面のドラッグ操作', () => {
  it('選択ノーツのドラッグを一回で往復し、Undo時の未確定候補を破棄する', async () => {
    const { wrapper, chart, bar, history } = setup([
      note({ isSelected: true }), note({ index: 2, lane: 3, isSelected: true }),
    ])
    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 550)
    expect(history.entries.value).toHaveLength(0)
    pointer(window, 'pointerup', 310, 550)
    expect(history.entries.value).toHaveLength(1)
    expect(chart.value.map(n => n.lane)).toEqual([3, 4])
    pointer(bar().element, 'pointerdown', 310, 550)
    pointer(window, 'pointermove', 250, 500)
    history.undo()
    pointer(window, 'pointerup', 250, 500)
    await nextTick()
    expect(chart.value.map(n => n.lane)).toEqual([2, 3])
    expect(wrapper.find('.note-drag-preview').exists()).toBe(false)
    expect(history.entries.value).toHaveLength(1)
    history.redo()
    expect(chart.value.map(n => n.lane)).toEqual([3, 4])
  })

  it('ドラッグのキャンセルと移動しないドロップは履歴を増やさない', () => {
    const { bar, history } = setup()
    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointerup', 250, 600)
    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 550)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    pointer(window, 'pointerup', 310, 550)
    expect(history.entries.value).toEqual([])
  })

  it('タッチで縦に動かすと、ドラッグのしきい値未満でも標準スクロールを抑止する', async () => {
    const { wrapper, chart, bar } = setup()
    const source = bar().element

    pointer(source, 'pointerdown', 250, 600, { pointerType: 'touch' })
    pointer(window, 'pointermove', 250, 599, { pointerType: 'touch' })
    expect(touchMove(source).defaultPrevented).toBe(true)
    await nextTick()
    expect(wrapper.find('.note-drag-preview').exists()).toBe(false)

    pointer(window, 'pointermove', 250, 550, { pointerType: 'touch' })
    expect(touchMove(source).defaultPrevented).toBe(true)
    await nextTick()
    expect(chart.value[0]).toMatchObject({ lane: 2, position: 1, split: 4 })
    expect(wrapper.get('.note-drag-preview').getComponent(NoteShadow).props('note'))
      .toMatchObject({ lane: 2, position: 3, split: 8 })

    pointer(window, 'pointerup', 250, 550, { pointerType: 'touch' })
    expect(chart.value[0]).toMatchObject({ lane: 2, position: 3, split: 8 })
    expect(touchMove(source).defaultPrevented).toBe(false)
  })

  it('移動しないタップは抑止せず、編集メニューを開く', async () => {
    const { wrapper, bar } = setup()
    const source = bar().element
    const down = pointer(source, 'pointerdown', 250, 600, { pointerType: 'touch' })
    const start = new Event('touchstart', { bubbles: true, cancelable: true })
    source.dispatchEvent(start)

    expect(down.defaultPrevented).toBe(false)
    expect(start.defaultPrevented).toBe(false)
    pointer(window, 'pointerup', 250, 600, { pointerType: 'touch' })
    await bar().trigger('click')
    expect(wrapper.find('input[aria-label="position"]').exists()).toBe(true)
  })

  it('譜面の空白やチェックボックス、音札から始めたタッチではスクロールを抑止しない', () => {
    const { content, bar } = setup()
    const checkbox = bar().get('input[type="checkbox"]').element

    for (const target of [content, checkbox]) {
      pointer(target, 'pointerdown', 250, 600, { pointerType: 'touch' })
      expect(touchMove(target).defaultPrevented).toBe(false)
      pointer(window, 'pointerup', 250, 550, { pointerType: 'touch' })
    }

    const otofuda = setup([note({ type: 5, lane: 3 })])
    const target = otofuda.bar().element
    pointer(target, 'pointerdown', 250, 600, { pointerType: 'touch' })
    expect(touchMove(target).defaultPrevented).toBe(false)
  })

  it('タッチで掴んだノーツ以外の指の移動や、マウス操作中のタッチを抑止しない', () => {
    const { bar, content } = setup()

    pointer(bar().element, 'pointerdown', 250, 600, { pointerType: 'touch' })
    expect(touchMove(content).defaultPrevented).toBe(false)
    expect(touchMove(document.body).defaultPrevented).toBe(false)
    pointer(window, 'pointerup', 250, 600, { pointerType: 'touch' })

    pointer(bar().element, 'pointerdown', 250, 600)
    expect(touchMove(bar().element).defaultPrevented).toBe(false)
    pointer(window, 'pointerup', 250, 600)
  })

  it('タッチ操作を中断したら標準スクロールの抑止も解除する', () => {
    const { chart, bar } = setup()
    const source = bar().element

    pointer(source, 'pointerdown', 250, 600, { pointerType: 'touch' })
    expect(touchMove(source).defaultPrevented).toBe(true)
    pointer(window, 'pointercancel', 250, 600, { pointerType: 'touch' })

    expect(touchMove(source).defaultPrevented).toBe(false)
    expect(chart.value[0]).toMatchObject({ lane: 2, position: 1, split: 4 })
  })

  it.each(['mouse', 'touch'])('%s で候補を表示し、ドロップ時だけ確定する', async pointerType => {
    const { wrapper, chart, bar, capture, release } = setup()
    pointer(bar().element, 'pointerdown', 250, 600, { pointerType })
    pointer(window, 'pointermove', 310, 550, { pointerType })
    await nextTick()
    expect(chart.value[0]).toMatchObject({ lane: 2, position: 1, split: 4 })
    const shadow = wrapper.get('.note-drag-preview').getComponent(NoteShadow)
    expect(shadow.props('note')).toMatchObject({ position: 3, split: 8 })
    expect(shadow.get('.note').classes()).toContain('shadow')
    expect(wrapper.find('.note-drag-preview').exists()).toBe(true)
    expect(capture).toHaveBeenCalledWith(1)
    if (pointerType === 'touch') {
      // 暗黙の捕捉が元のノーツから外れたイベントで、操作全体を取り消さない。
      pointer(bar().element, 'lostpointercapture', 310, 550, { pointerType })
    }
    pointer(window, 'pointerup', 310, 550, { pointerType })
    await nextTick()
    expect(chart.value[0]).toMatchObject({ lane: 3, position: 3, split: 8 })
    expect(wrapper.find('.note-drag-preview').exists()).toBe(false)
    expect(release).toHaveBeenCalledWith(1)
    await bar().trigger('click')
    expect(wrapper.find('input[aria-label="position"]').exists()).toBe(false)
  })

  it('しきい値未満の動きはクリックとして編集メニューを開く', async () => {
    const { wrapper, chart, bar, capture } = setup()
    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 252, 599)
    pointer(window, 'pointerup', 252, 599)
    await bar().trigger('click')
    expect(wrapper.find('input[aria-label="position"]').exists()).toBe(true)
    expect(chart.value[0].split).toBe(4)
    expect(capture).not.toHaveBeenCalled()
  })

  it('チェックボックスやコメント入力からドラッグを開始しない', async () => {
    const { wrapper, chart, bar } = setup()
    pointer(bar().get('input[type="checkbox"]').element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 550)
    pointer(window, 'pointerup', 310, 550)
    await nextTick()
    expect(chart.value[0].lane).toBe(2)
    expect(wrapper.find('.note-drag-preview').exists()).toBe(false)
    await bar().get('input[type="checkbox"]').setValue(true)
    expect(chart.value[0].isSelected).toBe(true)

    const comments = setup([note({ type: 100, lane: -1, option: ['コメント'] })])
    pointer(comments.bar().get('input:not([type="checkbox"])').element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 250, 550)
    pointer(window, 'pointerup', 250, 550)
    expect(comments.chart.value[0].split).toBe(4)
  })

  it.each(['Escape', 'pointercancel', 'blur', 'lostpointercapture'])('%s で候補を破棄する', async reason => {
    const { wrapper, chart, bar, content } = setup()
    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 550)
    if (reason === 'Escape') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: reason }))
    } else if (reason === 'blur') {
      window.dispatchEvent(new Event('blur'))
    } else {
      pointer(reason === 'lostpointercapture' ? content : window, reason, 310, 550)
    }
    pointer(window, 'pointerup', 310, 550)
    await nextTick()
    expect(chart.value[0]).toMatchObject({ lane: 2, position: 1, split: 4 })
    expect(wrapper.find('.note-drag-preview').exists()).toBe(false)
    expect(frames.size).toBe(0)
  })

  it('選択対象の1つが範囲外なら理由を表示して全体を取り消す', async () => {
    const { wrapper, chart, bar, showSnackbar } = setup([
      note({ isSelected: true }), note({ index: 2, lane: 5, isSelected: true }),
    ])
    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 550)
    await nextTick()
    expect(wrapper.get('.note-drag-preview').classes()).toContain('invalid')
    pointer(window, 'pointerup', 310, 550)
    expect(showSnackbar).toHaveBeenCalledWith(expect.stringContaining('レーン'))
    expect(chart.value.map(n => n.lane)).toEqual([2, 5])
  })

  it('split の設定を保持し、掴んだノーツ自身の split に切り替える', async () => {
    const { wrapper, chart, bar } = setup()
    const toggle = wrapper.get('input[aria-label="ドラッグ移動で各ノーツの split を使う"]')
    expect((toggle.element as HTMLInputElement).checked).toBe(false)
    await toggle.setValue(true)
    expect(localStorage.getItem('chart-editor__drag-own-split')).toBe('true')
    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 250, 540)
    pointer(window, 'pointerup', 250, 540)
    expect(chart.value[0]).toMatchObject({ position: 2, split: 4 })
    const next = setup()
    const restoredToggle = next.wrapper.get(
      'input[aria-label="ドラッグ移動で各ノーツの split を使う"]',
    )
    expect((restoredToggle.element as HTMLInputElement).checked).toBe(true)
  })

  it.each([false, true])('設定 %s で Shift を押しながらドラッグすると基準を反転する', async ownSplit => {
    const { wrapper, chart, bar } = setup()
    const toggle = wrapper.get('input[aria-label="ドラッグ移動で各ノーツの split を使う"]')
    await toggle.setValue(ownSplit)
    const stored = localStorage.getItem('chart-editor__drag-own-split')
    const expected = ownSplit ? { position: 3, split: 8 } : { position: 2, split: 4 }

    pointer(bar().element, 'pointerdown', 250, 600, { shiftKey: true })
    pointer(window, 'pointermove', 250, 540, { shiftKey: true })
    await nextTick()
    expect(wrapper.get('.note-drag-preview').getComponent(NoteShadow).props('note'))
      .toMatchObject(expected)
    pointer(window, 'pointerup', 250, 540, { shiftKey: true })

    expect(chart.value[0]).toMatchObject(expected)
    expect((toggle.element as HTMLInputElement).checked).toBe(ownSplit)
    expect(localStorage.getItem('chart-editor__drag-own-split')).toBe(stored)
  })

  it.each([false, true])('設定 %s で静止中の Shift 押下・解除を即時反映し、キーリピートでは反転しない', async ownSplit => {
    const { wrapper, chart, bar, history } = setup()
    const toggle = wrapper.get('input[aria-label="ドラッグ移動で各ノーツの split を使う"]')
    await toggle.setValue(ownSplit)
    const stored = localStorage.getItem('chart-editor__drag-own-split')
    const normal = ownSplit ? { position: 2, split: 4 } : { position: 3, split: 8 }
    const shifted = ownSplit ? { position: 3, split: 8 } : { position: 2, split: 4 }

    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 250, 540)
    await nextTick()
    const candidate = () => wrapper.get('.note-drag-preview').getComponent(NoteShadow).props('note')
    expect(candidate()).toMatchObject(normal)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true }))
    await nextTick()
    expect(candidate()).toMatchObject(shifted)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true, repeat: true }))
    await nextTick()
    expect(candidate()).toMatchObject(shifted)

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }))
    await nextTick()
    expect(candidate()).toMatchObject(normal)
    expect(chart.value[0]).toMatchObject({ position: 1, split: 4 })
    expect(history.entries.value).toHaveLength(0)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true }))
    pointer(window, 'pointerup', 250, 540, { shiftKey: true })
    expect(chart.value[0]).toMatchObject(shifted)
    expect(history.entries.value).toHaveLength(1)
    expect((toggle.element as HTMLInputElement).checked).toBe(ownSplit)
    expect(localStorage.getItem('chart-editor__drag-own-split')).toBe(stored)
  })

  it.each([false, true])('キーイベントがなくても移動・ドロップ時の Shift 状態 %s を反映する', async shiftKey => {
    const { wrapper, chart, bar } = setup()
    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 250, 540, { shiftKey })
    await nextTick()
    expect(wrapper.get('.note-drag-preview').getComponent(NoteShadow).props('note'))
      .toMatchObject(shiftKey ? { position: 2, split: 4 } : { position: 3, split: 8 })

    pointer(window, 'pointerup', 250, 540, { shiftKey: !shiftKey })
    expect(chart.value[0])
      .toMatchObject(shiftKey ? { position: 3, split: 8 } : { position: 2, split: 4 })
  })

  it('Shift だけではドラッグを開始せず、横移動中に切り替えても元の時刻を保つ', async () => {
    const { wrapper, chart, bar } = setup([note({ split: 12 })])
    pointer(bar().element, 'pointerdown', 250, 600)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true }))
    await nextTick()
    expect(wrapper.find('.note-drag-preview').exists()).toBe(false)

    pointer(window, 'pointermove', 310, 600, { shiftKey: true })
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }))
    await nextTick()
    expect(wrapper.get('.note-drag-preview').getComponent(NoteShadow).props('note'))
      .toMatchObject({ lane: 3, position: 1, split: 12 })
    pointer(window, 'pointerup', 310, 600)
    expect(chart.value[0]).toMatchObject({ lane: 3, position: 1, split: 12 })
  })

  it.each(['drop', 'Escape', 'pointercancel', 'blur'])('%s 後に Shift の状態やキーリスナーを残さない', async reason => {
    const { wrapper, chart, bar, history } = setup()
    const removeListener = vi.spyOn(window, 'removeEventListener')
    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 250, 540, { shiftKey: true })
    if (reason === 'drop') {
      pointer(window, 'pointerup', 250, 540, { shiftKey: true })
    } else if (reason === 'Escape') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', shiftKey: true }))
    } else if (reason === 'blur') {
      window.dispatchEvent(new Event('blur'))
    } else {
      pointer(window, 'pointercancel', 250, 540, { shiftKey: true })
    }
    await nextTick()
    expect(wrapper.find('.note-drag-preview').exists()).toBe(false)
    expect(removeListener).toHaveBeenCalledWith('keydown', expect.any(Function), true)
    expect(removeListener).toHaveBeenCalledWith('keyup', expect.any(Function), true)
    const before = JSON.stringify(chart.value)
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }))
    expect(JSON.stringify(chart.value)).toBe(before)

    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 250, 550)
    pointer(window, 'pointerup', 250, 550)
    expect(chart.value[0]).toMatchObject({ position: reason === 'drop' ? 5 : 3, split: 8 })
    expect(history.entries.value).toHaveLength(reason === 'drop' ? 2 : 1)
  })

  it('Shift で一括移動の基準を切り替えても、異なる split のノーツの間隔を保つ', () => {
    const { chart, bar, history } = setup([
      note({ isSelected: true }),
      note({ index: 2, lane: 3, split: 3, isSelected: true }),
    ])
    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 250, 540)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true }))
    pointer(window, 'pointerup', 250, 540, { shiftKey: true })

    expect(chart.value[0]).toMatchObject({ position: 2, split: 4 })
    expect(chart.value[1]).toMatchObject({ position: 7, split: 12 })
    expect(history.entries.value).toHaveLength(1)
  })

  it.each(['chart', 'draft'])('%s のロングの点は始点と異なる自身の split を Shift 中に使う', async source => {
    const root = note({ type: 2, end: [note({ type: 89, measure: 1, split: 6 })] })
    const draft = ref(root)
    const { wrapper, chart } = source === 'draft'
      ? setup([], { appendNote: draft.value })
      : setup([root])
    const handle = source === 'draft'
      ? placementShadow(wrapper).get('.draft-invisible-handle')
      : wrapper.getComponent(LongNote).get('.note-invisible-handle')
    pointer(handle.element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 250, 540)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true }))
    await nextTick()
    expect(wrapper.get('.note-drag-preview').getComponent(NoteShadow).props('note').end[0])
      .toMatchObject({ measure: 1, position: 2, split: 6 })
    pointer(window, 'pointerup', 250, 540, { shiftKey: true })

    const result = source === 'draft' ? draft.value : chart.value[0]
    expect(result).toMatchObject({ position: 1, split: 4 })
    expect(result.end[0]).toMatchObject({ measure: 1, position: 2, split: 6 })
  })

  it.each(['chart', 'draft'])('%s のロングの帯は Shift 中も各点の間隔を保つ', source => {
    const root = note({ type: 2, end: [note({ measure: 1, split: 6 })] })
    const draft = ref(root)
    const { wrapper, chart } = source === 'draft'
      ? setup([], { appendNote: draft.value })
      : setup([root])
    const band = source === 'draft'
      ? placementShadow(wrapper).get('.hold-fill')
      : wrapper.getComponent(LongNote).get('.hold-fill')
    pointer(band.element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 250, 540)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true }))
    pointer(window, 'pointerup', 250, 540, { shiftKey: true })

    const result = source === 'draft' ? draft.value : chart.value[0]
    expect(result).toMatchObject({ position: 2, split: 4 })
    expect(result.end[0]).toMatchObject({ measure: 1, position: 5, split: 12 })
  })

  it('音札と音札ダミーではドラッグを開始しない', async () => {
    const { wrapper, chart } = setup([
      note({ type: 5, lane: 3 }),
      note({ index: 2, type: 90, option: ['5'] }),
    ])
    for (const component of wrapper.findAllComponents(Note)) {
      expect(component.get('.note').classes()).not.toContain('note-draggable')
      pointer(component.get('.note').element, 'pointerdown', 250, 600)
      pointer(window, 'pointermove', 310, 550)
      pointer(window, 'pointerup', 310, 550)
    }
    await nextTick()
    expect(chart.value.map(n => n.split)).toEqual([4, 4])
  })

  it('ロングの不可視点にはハンドルを設け、直接ドラッグでその点だけ動かす', async () => {
    const root = note({ type: 2, isSelected: true, end: [note({ type: 89, measure: 1 })] })
    const { wrapper, chart } = setup([root])
    const handle = wrapper.findComponent(LongNote).get('.note-invisible-handle')
    expect(handle.classes()).not.toContain('touch-visible')
    await wrapper.findComponent(LongNote).get('.note').trigger('click')
    expect(handle.classes()).toContain('touch-visible')
    pointer(handle.element, 'pointerdown', 250, 600, { pointerType: 'touch' })
    pointer(window, 'pointermove', 310, 550, { pointerType: 'touch' })
    pointer(window, 'pointerup', 310, 550, { pointerType: 'touch' })
    expect(chart.value[0]).toMatchObject({ lane: 2, position: 1, split: 4 })
    expect(chart.value[0].end[0]).toMatchObject({ lane: 3, position: 3, split: 8 })
  })

  it.each([
    { type: 2, pointerType: 'mouse', selector: '.hold-fill' },
    { type: 90, pointerType: 'touch', selector: '.hold-border' },
  ])('$pointerType で未選択のロングの帯を掴み、分岐全体を移動する', async ({
    type,
    pointerType,
    selector,
  }) => {
    const root = note({
      type,
      lane: 2.5 as ExtendedNoteData['lane'],
      option: type === 90 ? ['2'] : [],
      end: [
        note({
          measure: 1,
          lane: 3.5 as ExtendedNoteData['lane'],
          option: ['1', '0', 'ease', '2'],
          end: [note({ measure: 2, lane: 4.5 as ExtendedNoteData['lane'] })],
        }),
        note({ type: 89, measure: 1, position: 2 }),
      ],
    })
    const selected = note({ index: 2, lane: 1, measure: 1, isSelected: true })
    const { wrapper, chart } = setup([root, selected])
    const long = wrapper.getComponent(LongNote)
    const band = long.get(selector)

    pointer(band.element, 'pointerdown', 250, 600, { pointerType })
    expect(touchMove(band.element).defaultPrevented).toBe(pointerType === 'touch')
    pointer(window, 'pointermove', 310, 550, { pointerType })
    await nextTick()

    expect(chart.value[0]).toMatchObject({ lane: 2.5, position: 1, split: 4 })
    const shadow = wrapper.get('.note-drag-preview').getComponent(NoteShadow)
    expect(shadow.props('note')).toMatchObject({ lane: 3.5, position: 3, split: 8 })

    pointer(window, 'pointerup', 310, 550, { pointerType })
    await nextTick()

    expect(chart.value[0]).toMatchObject({ lane: 3.5, position: 3, split: 8 })
    expect(chart.value[0].end[0]).toMatchObject({
      lane: 4.5,
      measure: 1,
      position: 3,
      split: 8,
      option: ['1', '0', 'ease', '2'],
    })
    expect(chart.value[0].end[0].end[0]).toMatchObject({
      lane: 5.5,
      measure: 2,
      position: 3,
      split: 8,
    })
    expect(chart.value[0].end[1]).toMatchObject({
      lane: 3,
      measure: 1,
      position: 5,
      split: 8,
    })
    expect(chart.value[1]).toMatchObject({ lane: 1, measure: 1, position: 1, split: 4 })

    await band.trigger('click')
    expect(long.find('input[aria-label="lane"]').exists()).toBe(false)

    pointer(band.element, 'pointerdown', 310, 550, { pointerType })
    pointer(window, 'pointerup', 310, 550, { pointerType })
    await band.trigger('click')
    expect(long.find('input[aria-label="lane"]').exists()).toBe(true)
  })

  it('ドラッグ中の外部編集で候補を破棄し、編集内容を上書きしない', async () => {
    const { wrapper, chart, bar } = setup()
    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 550)
    chart.value[0].position = 2
    pointer(window, 'pointerup', 310, 550)
    await nextTick()
    expect(chart.value[0]).toMatchObject({ lane: 2, position: 2, split: 4 })
    expect(wrapper.find('.note-drag-preview').exists()).toBe(false)
  })

  it('別の指のキャンセルでは操作を中断しない', async () => {
    const { chart, bar } = setup()
    pointer(bar().element, 'pointerdown', 250, 600, { pointerType: 'touch' })
    pointer(window, 'pointermove', 310, 550, { pointerType: 'touch' })
    pointer(window, 'pointercancel', 250, 600, { pointerId: 2, pointerType: 'touch' })
    pointer(window, 'pointerup', 310, 550, { pointerType: 'touch' })
    expect(chart.value[0]).toMatchObject({ lane: 3, position: 3, split: 8 })
  })

  it('再生開始で進行中のドラッグを取り消し、再生中は新たに移動しない', async () => {
    const { wrapper, chart, bar } = setup()
    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 550)
    await wrapper.findAll('button').find(button => button.text().includes('再生'))!.trigger('click')
    pointer(window, 'pointerup', 310, 550)
    expect(wrapper.find('.note-drag-preview').exists()).toBe(false)
    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 550)
    pointer(window, 'pointerup', 310, 550)
    expect(chart.value[0]).toMatchObject({ lane: 2, position: 1, split: 4 })
  })

  it('再生中以外でもキャプチャ・画像・プレビューモードでは移動を開始しない', async () => {
    for (const mode of ['isCaptureMode', 'isImageMode', 'isPreviewMode']) {
      const { wrapper, chart, bar } = setup([note()], {
        isShowDetail: true,
        isCaptureMode: true,
        [mode]: true,
      })
      pointer(bar().element, 'pointerdown', 250, 600)
      pointer(window, 'pointermove', 310, 550)
      pointer(window, 'pointerup', 310, 550)
      await nextTick()
      expect(chart.value[0].lane).toBe(2)
      expect(wrapper.find('.note-drag-preview').exists()).toBe(false)
    }
  })

  it('無効化された表示設定が残っていても通常表示では移動できる', async () => {
    const { chart, bar } = setup([note()], { isShowDetail: false, isCaptureMode: true, isImageMode: true })
    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 550)
    pointer(window, 'pointerup', 310, 550)
    expect(chart.value[0]).toMatchObject({ lane: 3, position: 3, split: 8 })
  })

  it('テクスチャ画像の標準ドラッグを抑止し、画像から位置を移動できる', async () => {
    const { chart, bar } = setup([note({ type: 94, option: ['texture/202020.png', '1', '0.25'] })])
    const img = bar().get('img')
    expect(img.attributes('draggable')).toBe('false')
    pointer(img.element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 550)
    pointer(window, 'pointerup', 310, 550)
    expect(chart.value[0]).toMatchObject({ lane: 3, position: 3, split: 8 })
  })

  it('画面端で自動スクロールし、スクロール分も移動先に反映する', async () => {
    const { wrapper, chart, bar, scrollBy } = setup()
    pointer(bar().element, 'pointerdown', 250, 35)
    pointer(window, 'pointermove', 250, 10)
    const id = frameId
    const callback = frames.get(id)!
    frames.delete(id)
    callback(16)
    await nextTick()
    expect(scrollBy).toHaveBeenCalledWith({ top: expect.any(Number), behavior: 'instant' })
    const shadow = wrapper.get('.note-drag-preview').getComponent(NoteShadow)
    expect(shadow.props('note')).toMatchObject({ position: 3, split: 8 })
    pointer(window, 'pointerup', 250, 10)
    expect(chart.value[0]).toMatchObject({ position: 3, split: 8 })
    expect(frames.size).toBe(0)
  })

  it('アンマウント時にイベントと自動スクロールを解除する', async () => {
    const { wrapper, chart, bar } = setup()
    const removeListener = vi.spyOn(window, 'removeEventListener')
    pointer(bar().element, 'pointerdown', 250, 600)
    pointer(window, 'pointermove', 310, 550, { shiftKey: true })
    wrapper.unmount()
    wrappers = wrappers.filter(w => w !== wrapper)
    expect(frames.size).toBe(0)
    expect(removeListener).toHaveBeenCalledWith('keydown', expect.any(Function), true)
    expect(removeListener).toHaveBeenCalledWith('keyup', expect.any(Function), true)
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }))
    pointer(window, 'pointerup', 310, 550)
    expect(chart.value[0].lane).toBe(2)
  })

  it('分割領域の端だけで自動スクロールし、操作パネル上では発動しない', () => {
    const { viewport, bar, scrollBy } = setup([note()], { contained: true, layout: 'stacked' })
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 375, 400))
    const localScroll = vi.fn()
    Object.assign(viewport, { scrollBy: localScroll })
    pointer(bar().element, 'pointerdown', 250, 350)
    pointer(window, 'pointermove', 250, 390)
    frames.get(frameId)!(16)
    expect(localScroll).toHaveBeenCalledWith({ top: expect.any(Number), behavior: 'instant' })
    expect(scrollBy).not.toHaveBeenCalled()
    localScroll.mockClear()
    pointer(window, 'pointermove', 250, 450)
    frames.get(frameId)!(32)
    expect(localScroll).not.toHaveBeenCalled()
    pointer(window, 'pointerup', 250, 450)
  })

  it('譜面領域の横スクロール分をノーツのドラッグ座標に反映する', async () => {
    const { viewport, chart, bar } = setup([note()], { contained: true, layout: 'stacked' })
    viewport.scrollLeft = 60
    pointer(bar().element, 'pointerdown', 250, 600)
    viewport.scrollLeft = 120
    viewport.dispatchEvent(new Event('scroll'))
    pointer(window, 'pointerup', 250, 600)
    await nextTick()
    expect(chart.value[0]).toMatchObject({ lane: 3, position: 1, split: 4 })
  })
})
