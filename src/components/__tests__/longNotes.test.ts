import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import type { ExtendedNoteData, Measure } from '../../types'
import { deleteNotesKey, showSnackbarKey } from '../../composables/injectionKeys'
import EndForm from '../EndForm.vue'
import LongNote from '../LongNote.vue'
import Preview from '../Preview.vue'

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
  const sourceStarts: ReturnType<typeof vi.fn>[] = []
  const resumeAudio = vi.fn()
  beforeEach(() => {
    vi.useFakeTimers()
    sourceStarts.length = 0
    resumeAudio.mockReset()
    vi.stubGlobal('AudioContext', class {
      state = 'suspended'
      destination = {}
      resume = resumeAudio.mockImplementation(() => {
        this.state = 'running'
        return Promise.resolve()
      })
      decodeAudioData = vi.fn().mockResolvedValue({})
      createBufferSource() {
        const start = vi.fn()
        sourceStarts.push(start)
        return { buffer: null, connect: vi.fn(), start }
      }
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    }))
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function setup() {
    const wrapper = mount(Preview, {
      props: {
        currentChart: [note({ type: 2, end: [note({ position: 1 }), note({ position: 3 })] })],
        measureData: measures,
        infoObject: { bpm: 120, beat: 4, offset: 0, version: 2 },
      },
      global: {
        stubs: { ...stubs, MeasureComponent: true, ObjectBasedMeasure: true, LongNote: true, NoteShadow: true },
        provide: { [showSnackbarKey as symbol]: vi.fn() },
      },
    })
    await flushPromises()
    return wrapper
  }

  it('発光をOFFにしても、打鍵音と終点音をそれぞれ1回ずつ再生する', async () => {
    const wrapper = await setup()
    try {
      await wrapper.get('input[aria-label="打鍵音を再生 (β)"]').setValue(true)
      await wrapper.get('input[aria-label="LN終点音を再生 (α)"]').setValue(true)
      await wrapper.findAll('button').find(button => button.text().endsWith('再生'))!.trigger('click')
      vi.advanceTimersByTime(1000)
      expect(resumeAudio).toHaveBeenCalledOnce()
      expect(sourceStarts).toHaveLength(3)
      sourceStarts.forEach(start => expect(start).toHaveBeenCalledExactlyOnceWith(0, 0.1))
      expect(wrapper.get('.combo strong').text()).toBe('2')
    } finally { wrapper.unmount() }
    expect(vi.getTimerCount()).toBe(0)
  })

  it('停止とアンマウントで発光と予約音を解除し、再再生にタイマーを残さない', async () => {
    const wrapper = await setup()
    const track = { play: vi.fn(), pause: vi.fn(), currentTime: 0, volume: 1 }
    await wrapper.setProps({ previewAudio: track as unknown as HTMLAudioElement })
    await wrapper.get('input[aria-label="キービームとコンボを表示"]').setValue(true)
    await wrapper.get('input[aria-label="打鍵音を再生 (β)"]').setValue(true)
    const start = wrapper.findAll('button').find(button => button.text().endsWith('再生'))!
    const stop = wrapper.findAll('button').find(button => button.text().endsWith('停止'))!
    await start.trigger('click')
    vi.advanceTimersByTime(100)
    const beam = wrapper.get('.keybeams').element.children[1]
    expect(beam.classList.contains('-hold')).toBe(true)
    await stop.trigger('click')
    expect(beam.className).toBe('')
    vi.advanceTimersByTime(1000)
    expect(track.play).not.toHaveBeenCalled()
    await start.trigger('click')
    vi.advanceTimersByTime(100)
    expect(beam.classList.contains('-hold')).toBe(true)
    wrapper.unmount()
    expect(beam.className).toBe('')
    expect(vi.getTimerCount()).toBe(0)
    const soundCount = sourceStarts.length
    vi.advanceTimersByTime(5000)
    expect(sourceStarts).toHaveLength(soundCount)
    expect(track.play).not.toHaveBeenCalled()
  })
})
