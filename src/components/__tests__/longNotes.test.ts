import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import type { ExtendedNoteData, Measure } from '../../types'
import { deleteNotesKey, showSnackbarKey } from '../../composables/injectionKeys'
import EndForm from '../EndForm.vue'
import LongNote from '../LongNote.vue'
import Preview from '../Preview.vue'
import { useChartData } from '../../composables/useChartData'
import { useFileIO } from '../../composables/useFileIO'
import { ControlledFileReader } from '../../composables/__tests__/controlledFileReader'
import { FakeAudioContext } from '../../composables/__tests__/fakeAudioContext'

function note(overrides: Partial<ExtendedNoteData> = {}): ExtendedNoteData {
  return { index: 1, type: 1, lane: 1, measure: 0, position: 0, split: 4, option: [], end: [], ...overrides }
}
const measures: Measure[] = [{
  measure: 0, measureBeat: 4, measureBpm: 120, measureHeight: 400,
  measureLength: 1000, measurePositionBottom: 0, measureReachTime: 100,
}]

// Vuetifyの見た目だけを置き換え、実際のDOM操作とイベントハンドラを検証する。
const layout = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
const textField = defineComponent({
  props: ['label', 'modelValue'], emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('input', {
    'aria-label': props.label, value: props.modelValue,
    onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
  }),
})
const checkbox = defineComponent({
  props: ['label', 'modelValue'], emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('input', {
    type: 'checkbox', 'aria-label': props.label, checked: props.modelValue,
    onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).checked),
  }),
})
const stubs = {
  ...Object.fromEntries([
    'v-row', 'v-col', 'v-spacer', 'v-select', 'v-combobox', 'v-alert',
    'v-card', 'v-list', 'v-list-item', 'v-card-title', 'v-divider', 'v-card-actions',
    'v-expansion-panels', 'v-expansion-panel', 'v-expansion-panel-title', 'v-expansion-panel-text',
    'v-icon', 'v-slider', 'v-switch',
  ].map(name => [name, layout])),
  'v-text-field': textField,
  'v-checkbox': checkbox,
  'v-btn': defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }),
  'v-menu': defineComponent({
    setup: (_, { slots }) => () => h('div', [slots.activator?.({ props: {} }), slots.default?.()]),
  }),
}

describe('ロングノートの編集・描画', () => {
  const interactiveMenu = defineComponent({
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup: (props, { emit, slots }) => () => h('div', [
      slots.activator?.({ props: { onClick: () => emit('update:modelValue', !props.modelValue) } }),
      slots.default?.(),
    ]),
  })

  function mountEditableLongNote(type = 2) {
    const root = note({
      index: 42, type, option: type === 90 ? ['2'] : [],
      end: [
        note({ position: 1, end: [note({ position: 2, lane: 2 })] }),
        note({ position: 3, lane: 3 }),
      ],
    })
    const wrapper = mount(LongNote, {
      props: { note: root, measureData: measures },
      global: {
        stubs: { ...stubs, 'v-menu': interactiveMenu },
        provide: { [deleteNotesKey as symbol]: vi.fn() },
      },
    })
    return { wrapper, root }
  }

  it.each([
    [2, 0, '.hold-fill'],
    [2, 1, '.hold-fill'],
    [2, 2, '.hold-fill'],
    [2, 0, '.hold-border'],
    [90, 1, '.hold-fill'],
  ])('type %s の帯 %s (%s) から対応する編集メニューを開く', async (type, segment, target) => {
    const { wrapper, root } = mountEditableLongNote(type)
    const bubbledClick = vi.fn()
    wrapper.element.addEventListener('click', bubbledClick)
    try {
      expect(wrapper.text()).not.toContain('#42 ロング')
      await wrapper.findAll('.long-note-svg g')[segment].get(target).trigger('click')
      expect(wrapper.text()).toContain('#42 ロング')
      expect(bubbledClick).not.toHaveBeenCalled()
      await wrapper.get('input[aria-label="lane"]').setValue('4')
      expect(root.lane).toBe(4)
    } finally { wrapper.unmount() }
  })

  it('始点と選択チェックボックスの操作を維持する', async () => {
    const { wrapper, root } = mountEditableLongNote()
    try {
      await wrapper.get('.note input[type="checkbox"]').setValue(true)
      expect(root.isSelected).toBe(true)
      expect(wrapper.text()).not.toContain('#42 ロング')
      await wrapper.get('.note').trigger('click')
      expect(wrapper.text()).toContain('#42 ロング')
    } finally { wrapper.unmount() }
  })

  it('ダミーLN始点に擬態先の描画クラスとisDummyを付ける', () => {
    const wrapper = mount(LongNote, {
      props: { note: note({ type: 90, option: ['2'] }), measureData: measures },
      global: { stubs, provide: { [deleteNotesKey as symbol]: vi.fn() } },
    })
    expect(wrapper.get('.note').classes()).toContain('type2')
    expect(wrapper.get('.note').classes()).toContain('isDummy')
    expect(wrapper.get('.note').classes()).not.toContain('type90')
    wrapper.unmount()
  })

  it.each([['ArrowLeft', 0], ['ArrowRight', 6]])('終点移動%sを連打しても境界%sで止まる', async (key, boundary) => {
    const end = note({ lane: 2.5 as any, position: 1 })
    const wrapper = mount(EndForm, {
      props: { end, parent: note({ type: 2 }), index: 0 }, global: { stubs },
    })
    const position = wrapper.get('input[aria-label="position"]')
    for (let n = 0; n < 10; n++) await position.trigger('keydown', { key })
    expect(end.lane).toBe(boundary)
    wrapper.unmount()
  })
})

describe('Previewとの接続と後始末', () => {
  const soundCount = () => FakeAudioContext.instances.reduce((count, context) =>
    count + context.sources.reduce((n, source) => n + source.start.mock.calls.length, 0), 0)
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    FakeAudioContext.instances = []
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }))
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function setup(props = {}, showSnackbar = vi.fn()) {
    return mount(Preview, {
      props: {
        currentChart: [note({ type: 2, end: [note({ position: 1 }), note({ position: 3 })] })],
        measureData: measures,
        infoObject: { bpm: 120, beat: 4, offset: 0, version: 2 },
        ...props,
      },
      global: {
        stubs: { ...stubs, MeasureComponent: true, ObjectBasedMeasure: true, LongNote: true, NoteShadow: true },
        provide: { [showSnackbarKey as symbol]: showSnackbar },
      },
    })
  }

  it('発光をOFFにしても、打鍵音と終点音をそれぞれ1回ずつ再生する', async () => {
    const wrapper = setup()
    try {
      await wrapper.get('input[aria-label="打鍵音を再生 (β)"]').setValue(true)
      await wrapper.get('input[aria-label="LN終点音を再生 (α)"]').setValue(true)
      await wrapper.findAll('button').find(button => button.text().endsWith('再生'))!.trigger('click')
      await flushMedia()
      vi.advanceTimersByTime(1000)
      expect(soundCount()).toBe(3)
      const context = FakeAudioContext.instances[0]
      expect(context.resume).toHaveBeenCalledOnce()
      context.sources.forEach(source => expect(source.start).toHaveBeenCalledExactlyOnceWith(0, 0.1))
      expect(wrapper.get('.combo strong').text()).toBe('2')
    } finally { wrapper.unmount() }
    expect(vi.getTimerCount()).toBe(0)
  })

  it('停止とアンマウントで発光と予約音を解除し、再再生にタイマーを残さない', async () => {
    const wrapper = setup()
    const track = { play: vi.fn(), pause: vi.fn(), currentTime: 0, volume: 1 }
    await wrapper.setProps({ previewAudio: track as unknown as HTMLAudioElement })
    await wrapper.get('input[aria-label="キービームとコンボを表示"]').setValue(true)
    await wrapper.get('input[aria-label="打鍵音を再生 (β)"]').setValue(true)
    const start = wrapper.findAll('button').find(button => button.text().endsWith('再生'))!
    const stop = wrapper.findAll('button').find(button => button.text().endsWith('停止'))!
    await start.trigger('click')
    await flushMedia()
    vi.advanceTimersByTime(112)
    const beam = wrapper.get('.keybeams').element.children[1]
    expect(beam.classList.contains('-hold')).toBe(true)
    await stop.trigger('click')
    expect(beam.className).toBe('')
    vi.advanceTimersByTime(1000)
    expect(track.play).not.toHaveBeenCalled()
    await start.trigger('click')
    await flushMedia()
    vi.advanceTimersByTime(112)
    expect(beam.classList.contains('-hold')).toBe(true)
    wrapper.unmount()
    expect(beam.className).toBe('')
    expect(vi.getTimerCount()).toBe(0)
    const soundsBefore = soundCount()
    vi.advanceTimersByTime(5000)
    expect(soundCount()).toBe(soundsBefore)
    expect(track.play).not.toHaveBeenCalled()
  })

  const flushMedia = async () => { for (let i = 0; i < 16; i++) await Promise.resolve() }
  function loadedTrack() {
    return Object.assign(new EventTarget(), {
      src: 'blob:track', currentSrc: 'blob:track', currentTime: 0, duration: 60,
      readyState: 4, seeking: false, error: null, volume: 1,
      pause: vi.fn(), play: vi.fn(() => Promise.resolve()), load: vi.fn(),
    })
  }
  const realMeasures = Array.from({ length: 5 }, (_, measure) => ({
    measure, measureBeat: 4, measureBpm: 120, measureHeight: 400,
    measureLength: 2000, measurePositionBottom: measure * 400, measureReachTime: measure * 2000,
  }))

  it('初回の補助音読み込み中に停止しても、準備完了後に旧再生が始まらない', async () => {
    let resolve!: (response: unknown) => void
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(done => { resolve = done }) as Promise<Response>)
    const track = loadedTrack()
    const wrapper = setup({ previewAudio: track, measureData: realMeasures, currentChart: [note({ measure: 1 })] })
    const start = wrapper.findAll('button').find(button => button.text().endsWith('再生'))!
    try {
      await wrapper.get('input[aria-label="打鍵音を再生 (β)"]').setValue(true)
      await start.trigger('click')
      vi.advanceTimersByTime(3000)
      expect(track.play).not.toHaveBeenCalled()
      expect(soundCount()).toBe(0)
      wrapper.vm.stop()
      expect(vi.getTimerCount()).toBe(0)
      resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })
      await flushMedia()
      vi.advanceTimersByTime(5000)
      expect(track.play).not.toHaveBeenCalled()
      expect(soundCount()).toBe(0)
      expect(vi.getTimerCount()).toBe(0)
      await start.trigger('click')
      await flushMedia()
      vi.advanceTimersByTime(2100)
      await flushMedia()
      vi.advanceTimersByTime(16)
      expect(track.play).toHaveBeenCalledOnce()
      expect(soundCount()).toBe(1)
      expect(fetch).toHaveBeenCalledOnce()
    } finally { wrapper.unmount() }
    const context = FakeAudioContext.instances[0]
    expect(context.close).toHaveBeenCalledOnce()
    context.sources.forEach(source => expect(source.stop).toHaveBeenCalledOnce())
    expect(vi.getTimerCount()).toBe(0)
  })

  it('補助音の準備失敗を通知して停止し、再操作で先頭から発音できる', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response)
    const track = loadedTrack()
    const showSnackbar = vi.fn()
    const wrapper = setup({ previewAudio: track, measureData: realMeasures, currentChart: [note({ measure: 1 })] }, showSnackbar)
    const start = wrapper.findAll('button').find(button => button.text().endsWith('再生'))!
    try {
      await wrapper.get('input[aria-label="打鍵音を再生 (β)"]').setValue(true)
      await start.trigger('click')
      await flushMedia()
      vi.advanceTimersByTime(3000)
      expect(track.play).not.toHaveBeenCalled()
      expect(showSnackbar).toHaveBeenCalledWith(expect.stringContaining('補助音を読み込めませんでした'))
      expect((wrapper.get('.preview').element as HTMLElement).style.position).not.toBe('fixed')
      await start.trigger('click')
      await flushMedia()
      vi.advanceTimersByTime(2100)
      await flushMedia()
      vi.advanceTimersByTime(16)
      expect(track.play).toHaveBeenCalledOnce()
      expect(soundCount()).toBe(1)
    } finally { wrapper.unmount() }
  })

  it.each([false, true])('打鍵音OFFでも小節ガイド音を再生できる（途中で有効化=%s）', async enableLater => {
    const wrapper = setup({ measureData: realMeasures, currentChart: [] })
    try {
      const guide = wrapper.get('input[aria-label="小節ガイド音を再生"]')
      if (!enableLater) await guide.setValue(true)
      await wrapper.findAll('button').find(button => button.text().endsWith('再生'))!.trigger('click')
      await flushMedia()
      vi.advanceTimersByTime(112)
      if (enableLater) {
        expect(FakeAudioContext.instances).toHaveLength(0)
        await guide.setValue(true)
        await flushMedia()
      }
      vi.advanceTimersByTime(2000)
      expect(soundCount()).toBe(enableLater ? 1 : 2)
      expect(FakeAudioContext.instances[0].decodeAudioData).toHaveBeenCalledOnce()
    } finally { wrapper.unmount() }
    expect(vi.getTimerCount()).toBe(0)
  })

  function setupLiveSettings(notes = [note({ measure: 1 }), note({ type: 99, measure: 5 })]) {
    const data = useChartData()
    data.beatHeight.value = 100
    data.chartObject.value.easy = notes
    const volume = ref(100)
    const track = loadedTrack()
    const host = defineComponent({
      setup: () => () => h(Preview, {
        currentChart: data.currentChart.value,
        currentDifficulty: data.currentDifficulty.value,
        measureData: data.measureData.value,
        infoObject: { ...data.chartObject.value.info, version: data.chartObject.value.info.version ?? 2 },
        previewAudio: track as unknown as HTMLAudioElement,
        audioVolume: volume.value,
      }),
    })
    const wrapper = mount(host, { global: {
      stubs: { ...stubs, MeasureComponent: true, ObjectBasedMeasure: true, LongNote: true, NoteShadow: true },
      provide: { [showSnackbarKey as symbol]: vi.fn() },
    } })
    const view = wrapper.findComponent(Preview)
    const start = () => view.findAll('button').find(button => button.text().endsWith('再生'))!.trigger('click')
    const begin = async () => {
      await start()
      await flushMedia()
      vi.advanceTimersByTime(2100)
      await flushMedia()
      vi.advanceTimersByTime(16)
    }
    const at = async (seconds: number) => {
      track.currentTime = seconds
      vi.advanceTimersByTime(16)
      await flushMedia()
    }
    const position = () => Number.parseFloat((view.get('.preview-content').element as HTMLElement).style.transform.split(',')[1] ?? '0')
    const sounds = soundCount
    const isPlaying = () => (view.get('.preview').element as HTMLElement).style.position === 'fixed'
    return { data, volume, track, wrapper, view, start, begin, at, position, sounds, isPlaying }
  }

  it('ハイスピードを変更しても音源を止めず、最新の高さで次の描画から追従する', async () => {
    const s = setupLiveSettings()
    try {
      await s.begin()
      await s.at(0.5)
      expect(s.position()).toBe(500)
      const pauses = s.track.pause.mock.calls.length
      s.data.beatHeight.value = 200
      await flushMedia()
      expect(s.isPlaying()).toBe(true)
      expect(s.position()).toBe(1000)
      expect(s.track.currentTime).toBe(0.5)
      expect(s.track.pause).toHaveBeenCalledTimes(pauses)
      expect(s.track.play).toHaveBeenCalledOnce()
      await s.at(1.5)
      expect(s.position()).toBe(1400)
    } finally { s.wrapper.unmount() }
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['preparing', 'counting-in', 'starting', 'playing'])('%s中の音量変更を即反映し、開始時にも巻き戻さない', async phase => {
    const s = setupLiveSettings()
    let resolvePlay: (() => void) | undefined
    if (phase === 'preparing') s.track.readyState = 0
    if (phase === 'starting') s.track.play.mockImplementation(() => new Promise<void>(resolve => { resolvePlay = resolve }))
    try {
      await s.start()
      await flushMedia()
      if (phase === 'starting' || phase === 'playing') {
        vi.advanceTimersByTime(2100)
        await flushMedia()
        vi.advanceTimersByTime(16)
      }
      const pauses = s.track.pause.mock.calls.length
      s.volume.value = 35
      if (phase === 'preparing') {
        s.data.beatHeight.value = 150
        s.data.chartObject.value.info.offset = 250
      }
      await flushMedia()
      expect(s.track.volume).toBe(0.35)
      expect(s.track.pause).toHaveBeenCalledTimes(pauses)
      expect(s.isPlaying()).toBe(true)
      if (phase === 'preparing') {
        s.track.readyState = 4
        s.track.dispatchEvent(new Event('canplay'))
        await flushMedia()
      }
      if (phase === 'preparing' || phase === 'counting-in') vi.advanceTimersByTime(2100)
      resolvePlay?.()
      await flushMedia()
      vi.advanceTimersByTime(16)
      expect(s.track.play).toHaveBeenCalledOnce()
      expect(s.track.volume).toBe(0.35)
      s.volume.value = 0
      await flushMedia()
      expect(s.track.volume).toBe(0)
      expect(s.track.pause).toHaveBeenCalledTimes(pauses)
    } finally { s.wrapper.unmount() }
  })

  it('オフセットを前後に調整しても再シーク・二重発音・二重コンボをせず、LNの発光を復元する', async () => {
    const s = setupLiveSettings([
      note({ type: 2, measure: 1, end: [note({ measure: 2 })] }),
      note({ measure: 1, position: 1, lane: 2 }),
      note({ measure: 2, position: 1, lane: 3 }),
      note({ type: 99, measure: 5 }),
    ])
    try {
      for (const label of ['キービームとコンボを表示', '打鍵音を再生 (β)', 'LN終点音を再生 (α)']) {
        await s.view.get(`input[aria-label="${label}"]`).setValue(true)
      }
      const hold = () => s.view.get('.keybeams').element.children[1].classList.contains('-hold')
      const combo = () => s.view.get('.combo strong').text()
      const offset = async (value: number) => { s.data.chartObject.value.info.offset = value; await flushMedia() }
      await s.begin()
      await s.at(0.5)
      expect(s.sounds()).toBe(2)
      expect(combo()).toBe('1')
      expect(hold()).toBe(true)
      const pauses = s.track.pause.mock.calls.length
      await offset(1000)
      expect(s.isPlaying()).toBe(true)
      expect(s.track.currentTime).toBe(0.5)
      expect(hold()).toBe(false)
      const liveMeasure = s.view.props('measureData')![1]
      expect(liveMeasure.measurePositionBottom - s.position()).toBe(100)
      await s.at(1.5)
      expect(hold()).toBe(true)
      expect(s.sounds()).toBe(2)
      expect(combo()).toBe('1')
      await offset(0)
      await s.at(2)
      expect(hold()).toBe(false)
      expect(s.sounds()).toBe(3)
      expect(combo()).toBe('2')
      await offset(1000)
      expect(hold()).toBe(true)
      await s.at(3)
      expect(hold()).toBe(false)
      expect(s.sounds()).toBe(3)
      await offset(-1000)
      expect(combo()).toBe('3')
      expect(s.sounds()).toBe(3)
      await offset(1000)
      await s.at(3.5)
      expect(combo()).toBe('3')
      expect(s.sounds()).toBe(3)
      expect(s.track.pause).toHaveBeenCalledTimes(pauses)
      expect(s.track.play).toHaveBeenCalledOnce()
    } finally { s.wrapper.unmount() }
    expect(vi.getTimerCount()).toBe(0)
  })

  it('play完了待ちのオフセット変更で到達音を先行させない', async () => {
    const s = setupLiveSettings()
    let resolvePlay!: () => void
    s.track.play.mockImplementation(() => new Promise<void>(resolve => { resolvePlay = resolve }))
    try {
      await s.view.get('input[aria-label="打鍵音を再生 (β)"]').setValue(true)
      await s.start()
      await flushMedia()
      vi.advanceTimersByTime(2100)
      s.data.chartObject.value.info.offset = -500
      await flushMedia()
      expect(s.sounds()).toBe(0)
      expect(s.isPlaying()).toBe(true)
      resolvePlay()
      await flushMedia()
      vi.advanceTimersByTime(16)
      expect(s.sounds()).toBe(0)
      expect(s.view.get('.combo strong').text()).toBe('1')
      expect(s.track.play).toHaveBeenCalledOnce()
    } finally { s.wrapper.unmount() }
  })

  it.each(['bpm', 'beat', 'chart', 'note'])('%sの変更は引き続き旧譜面の再生を停止する', async field => {
    const s = setupLiveSettings()
    try {
      await s.begin()
      if (field === 'bpm') s.data.chartObject.value.info.bpm = 180
      else if (field === 'beat') s.data.chartObject.value.info.beat = 3
      else if (field === 'note') s.data.currentChart.value[0].position = 1
      else s.data.chartObject.value.easy = [...s.data.currentChart.value]
      await flushMedia()
      expect(s.isPlaying()).toBe(false)
      expect(vi.getTimerCount()).toBe(0)
    } finally { s.wrapper.unmount() }
  })

  it('ノートの選択状態だけの変更ではプレビューを停止しない', async () => {
    const s = setupLiveSettings()
    try {
      await s.begin()
      const pauses = s.track.pause.mock.calls.length
      s.data.currentChart.value[0].isSelected = true
      await flushMedia()
      expect(s.isPlaying()).toBe(true)
      expect(s.track.pause).toHaveBeenCalledTimes(pauses)
    } finally { s.wrapper.unmount() }
  })

  it.each(['', '-', 'abc'])('オフセット入力途中の%sでも再生を止めず、有限の座標で描画する', async value => {
    const s = setupLiveSettings()
    try {
      s.data.chartObject.value.info.offset = 250
      await flushMedia()
      await s.begin()
      await s.at(0.5)
      const pauses = s.track.pause.mock.calls.length
      s.data.chartObject.value.info.offset = value as any
      await flushMedia()
      expect(s.isPlaying()).toBe(true)
      expect(Number.isFinite(s.position())).toBe(true)
      expect(s.track.currentTime).toBe(0.5)
      expect(s.track.pause).toHaveBeenCalledTimes(pauses)
    } finally { s.wrapper.unmount() }
  })

  it('途中小節からの再生でもオフセット・ハイスピード・音量を同時に反映する', async () => {
    const s = setupLiveSettings([note({ measure: 2 }), note({ type: 99, measure: 5 })])
    try {
      await s.view.get('input[aria-label="再生開始小節"]').setValue(2)
      await s.view.get('input[aria-label="打鍵音を再生 (β)"]').setValue(true)
      await s.begin()
      expect(s.track.currentTime).toBe(2)
      expect(s.sounds()).toBe(1)
      const pauses = s.track.pause.mock.calls.length
      s.data.chartObject.value.info.offset = 500
      s.data.beatHeight.value = 200
      s.volume.value = 45
      await flushMedia()
      expect(s.isPlaying()).toBe(true)
      expect(s.position()).toBe(1600)
      expect(s.track.volume).toBe(0.45)
      expect(s.track.currentTime).toBe(2)
      await s.at(2.5)
      expect(s.sounds()).toBe(1)
      expect(s.track.pause).toHaveBeenCalledTimes(pauses)
      expect(s.track.play).toHaveBeenCalledOnce()
    } finally { s.wrapper.unmount() }
  })

  it('音源なしでも設定へ追従し、オフセットで延びた末尾まで再生する', async () => {
    const s = setupLiveSettings()
    s.track.src = s.track.currentSrc = ''
    try {
      await s.begin()
      s.data.chartObject.value.info.offset = 2000
      s.data.beatHeight.value = 200
      await flushMedia()
      expect(s.isPlaying()).toBe(true)
      vi.advanceTimersByTime(10000)
      expect(s.isPlaying()).toBe(true)
      vi.advanceTimersByTime(2000)
      await flushMedia()
      expect(s.isPlaying()).toBe(false)
      expect(s.track.play).not.toHaveBeenCalled()
    } finally { s.wrapper.unmount() }
  })

  it.each(['preparing', 'counting-in', 'starting', 'playing', 'stopped'])(
    '%s中に譜面を選択すると、読み込み完了を待たず全予約を解除して再操作できる', async phase => {
      ControlledFileReader.instances = []
      vi.stubGlobal('FileReader', ControlledFileReader)
      const track = loadedTrack()
      let resolveOldPlay: (() => void) | undefined
      if (phase === 'preparing') track.readyState = 0
      if (phase === 'starting') track.play.mockImplementation(() => new Promise<void>(resolve => { resolveOldPlay = resolve }))
      const wrapper = setup({
        previewAudio: track, measureData: realMeasures,
        currentChart: [
          note({ type: 2, measure: 1, end: [note({ measure: 2 })] }),
          note({ type: 3, measure: 1, lane: 2, option: ['1'] }),
        ],
      })
      const data = useChartData()
      const io = useFileIO(data, vi.fn(), () => wrapper.vm.stop())
      const start = wrapper.findAll('button').find(button => button.text().endsWith('再生'))!
      try {
        for (const label of ['キービームとコンボを表示', '打鍵音を再生 (β)', 'フリックエフェクト (β)', 'LeapMotion補助線をシミュレート (α)']) {
          await wrapper.get(`input[aria-label="${label}"]`).setValue(true)
        }
        await start.trigger('click')
        await flushMedia()
        vi.advanceTimersByTime(phase === 'preparing' || phase === 'counting-in' ? 112 : 2100)
        await flushMedia()
        vi.advanceTimersByTime(16)
        if (phase === 'playing') {
          expect(wrapper.find('.flick-effect').exists()).toBe(true)
          expect(wrapper.get('.keybeams').element.children[1].classList.contains('-hold')).toBe(true)
        }
        if (phase === 'stopped') {
          await wrapper.findAll('button').find(button => button.text().endsWith('停止'))!.trigger('click')
          expect(vi.getTimerCount()).toBe(1) // 通常停止のスクロール復元予約
        }

        io.readFile(new File([''], 'next.json'))
        expect(vi.getTimerCount()).toBe(0)
        expect(track.pause).toHaveBeenCalled()
        expect(wrapper.find('.flick-effect').exists()).toBe(false)
        expect(wrapper.get('.keybeams').element.children[1].className).toBe('')
        expect((wrapper.get('.preview-content').element as HTMLElement).style.transform).toBe('')
        const plays = track.play.mock.calls.length
        const sounds = soundCount()

        resolveOldPlay?.()
        track.readyState = 4
        track.dispatchEvent(new Event('canplay'))
        ControlledFileReader.instances[0].complete(JSON.stringify(data.chartObject.value))
        await flushMedia()
        vi.advanceTimersByTime(5000)
        expect(track.play).toHaveBeenCalledTimes(plays)
        expect(soundCount()).toBe(sounds)
        expect(vi.getTimerCount()).toBe(0)

        track.play.mockResolvedValue(undefined)
        await start.trigger('click')
        await flushMedia()
        vi.advanceTimersByTime(2100)
        await flushMedia()
        vi.advanceTimersByTime(16)
        expect(track.play).toHaveBeenCalledTimes(plays + 1)
        expect((wrapper.get('.preview-content').element as HTMLElement).style.transform).toContain('translate3d')
      } finally { wrapper.unmount() }
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('初回のplay()が遅れてもノートの音を先行させず、音源時刻で描画する', async () => {
    const track = loadedTrack()
    let resolve!: () => void
    track.play.mockImplementation(() => new Promise<void>(done => { resolve = done }))
    const wrapper = setup({
      previewAudio: track, measureData: realMeasures, currentChart: [note({ measure: 1 })],
    })
    try {
      await wrapper.get('input[aria-label="打鍵音を再生 (β)"]').setValue(true)
      await wrapper.findAll('button').find(button => button.text().endsWith('再生'))!.trigger('click')
      await flushMedia()
      vi.advanceTimersByTime(2600)
      expect(track.play).toHaveBeenCalledOnce()
      expect(soundCount()).toBe(0)
      expect(Number.parseFloat((wrapper.get('.preview-content').element as HTMLElement).style.transform.split(',')[1]?.trim())).toBeLessThan(400)
      resolve()
      await flushMedia()
      vi.advanceTimersByTime(16)
      expect((wrapper.get('.preview-content').element as HTMLElement).style.transform.split(',')[1]?.trim()).toBe('400px')
      expect((wrapper.get('.preview').element as HTMLElement).style.bottom).toBe('0px')
      expect((wrapper.get('.preview-content').element as HTMLElement).style.transform).toContain('translate3d')
      expect((wrapper.get('.preview-content').element as HTMLElement).style.willChange).toBe('transform')
      expect(wrapper.get('.combo strong').text()).toBe('1')
      expect(soundCount()).toBe(1)
      track.currentTime = 0.5
      vi.advanceTimersByTime(16)
      expect((wrapper.get('.preview-content').element as HTMLElement).style.transform.split(',')[1]?.trim()).toBe('500px')
      // 描画位置調整でVueが再描画しても、スクロール位置を上書きしない。
      await wrapper.get('input[aria-label="判定位置調整(β)"]').setValue(25)
      expect((wrapper.get('.preview').element as HTMLElement).style.transform).toBe('translateY(25px)')
      expect((wrapper.get('.preview-content').element as HTMLElement).style.transform.split(',')[1]?.trim()).toBe('500px')
      vi.advanceTimersByTime(5000)
      expect((wrapper.get('.preview-content').element as HTMLElement).style.transform.split(',')[1]?.trim()).toBe('500px')
    } finally { wrapper.unmount() }
    expect(vi.getTimerCount()).toBe(0)
  })

  it('音源の再生に失敗したら停止表示へ戻り、1回の再操作で再生できる', async () => {
    const track = loadedTrack()
    track.play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
    const showSnackbar = vi.fn()
    const wrapper = setup({ previewAudio: track, measureData: realMeasures }, showSnackbar)
    const start = wrapper.findAll('button').find(button => button.text().endsWith('再生'))!
    try {
      await start.trigger('click')
      await flushMedia()
      vi.advanceTimersByTime(2100)
      await flushMedia()
      expect(showSnackbar).toHaveBeenCalledWith(expect.stringContaining('プレビューを再生できませんでした'))
      expect((wrapper.get('.preview').element as HTMLElement).style.bottom).toBe('0px')
      await start.trigger('click')
      await flushMedia()
      vi.advanceTimersByTime(2100)
      await flushMedia()
      vi.advanceTimersByTime(16)
      expect(track.play).toHaveBeenCalledTimes(2)
      expect((wrapper.get('.preview-content').element as HTMLElement).style.transform.split(',')[1]?.trim()).toBe('400px')
    } finally { wrapper.unmount() }
  })
})
