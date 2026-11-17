import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VMenu } from 'vuetify/components/VMenu'
import { VSwitch } from 'vuetify/components/VSwitch'
import type { ExtendedNoteData, Measure } from '../../types'
import {
  appendNotesKey,
  copyNotesToDifficultyKey,
  deleteNotesKey,
  getMovedNoteKey,
  setAppendNoteInfoKey,
  showSnackbarKey,
} from '../../composables/injectionKeys'
import Preview from '../Preview.vue'
import Note from '../Note.vue'
import LongNote from '../LongNote.vue'

/** 操作パネルの設定と、再生フレームからの描画を結び付けるための選択ラベル。 */
const MOTION_LABEL = 'ノーツ個別の speed・orbit を再現 (β)'

/** 通常の4拍小節を並べ、途中の再生位置でノーツの変位を比較できるタイムライン。 */
const measures: Measure[] = Array.from({ length: 6 }, (_, measure) => ({
  measure,
  measureBeat: 4,
  measureBpm: 120,
  measureHeight: 400,
  measureLength: 2000,
  measurePositionBottom: measure * 400,
  measureReachTime: measure * 2000,
}))

/** 個別描画と無関係な装飾を簡略化し、子要素を表示する。 */
const layout = defineComponent({
  setup: (_, { slots }) => () => h('div', slots.default?.()),
})

let wrapper: VueWrapper | undefined
let now = 0
let frameId = 0
let frames: Map<number, FrameRequestCallback>

beforeEach(() => {
  localStorage.clear()
  now = 0
  frameId = 0
  frames = new Map()

  vi.useFakeTimers()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.stubGlobal('innerHeight', 900)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback)
    return frameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''

  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** 倍率や軌道の違いが、通常ノーツとロングの両方へ現れる検証用ノーツを作る。 */
function note(overrides: Partial<ExtendedNoteData> = {}): ExtendedNoteData {
  return {
    index: 1,
    type: 1,
    lane: 1,
    measure: 2,
    position: 0,
    split: 4,
    option: ['2', '1'],
    end: [],
    ...overrides,
  }
}

/**
 * 実際のVuetifyのメニューとスイッチを使い、プレビューを描画する。
 * activatorが渡すrefを含め、入力からノーツ要素までの参照の受け渡しを検証する。
 *
 * @param restored 起動時から個別描画をONにする保存値を用意する場合はtrue。
 */
function setup(restored: boolean) {
  if (restored) {
    localStorage.setItem('chart-editor__simulate-note-motion', 'true')
  }

  wrapper = mount(Preview, {
    attachTo: document.body,
    props: {
      infoObject: { bpm: 120, beat: 4, offset: 0, version: 2 },
      measureData: measures,
      beatHeight: 100,
      currentChart: [
        note(),
        note({
          index: 2,
          type: 2,
          measure: 1,
          position: 2,
          end: [note({ index: 3, position: 2, option: ['0.5', '-1', 'ease'] })],
        }),
      ],
    },
    global: {
      plugins: [createVuetify()],
      components: { VMenu, VSwitch },
      stubs: {
        ...Object.fromEntries([
          'v-expansion-panels', 'v-expansion-panel', 'v-expansion-panel-title',
          'v-expansion-panel-text', 'v-card', 'v-card-text', 'v-card-actions',
          'v-list', 'v-list-item', 'v-list-item-title', 'v-icon', 'v-divider',
          'v-spacer', 'v-radio-group', 'v-radio', 'v-checkbox', 'v-text-field',
          'v-slider', 'v-tooltip', 'v-textarea', 'v-select', 'v-row', 'v-col',
        ].map(name => [name, layout])),
        'v-btn': defineComponent({
          props: ['disabled'],
          setup: (props, { slots }) => () => h('button', {
            disabled: props.disabled,
          }, slots.default?.()),
        }),
        NoteShadow: true,
      },
      provide: {
        [showSnackbarKey as symbol]: vi.fn(),
        [deleteNotesKey as symbol]: vi.fn(),
        [appendNotesKey as symbol]: vi.fn(),
        [getMovedNoteKey as symbol]: vi.fn(),
        [copyNotesToDifficultyKey as symbol]: vi.fn(),
        [setAppendNoteInfoKey as symbol]: vi.fn(),
      },
    },
  })

  const switchComponent = wrapper.findAllComponents(VSwitch)
    .find(component => component.props('label') === MOTION_LABEL)!

  return {
    wrapper,
    input: switchComponent.get('input[type="checkbox"]'),
    start: wrapper.findAll('.control button').find(button => button.text().endsWith('再生'))!,
    stop: wrapper.findAll('.control button').find(button => button.text().endsWith('停止'))!,
  }
}

/** 音源なしの再生時計を指定時刻まで進め、予約された描画フレームを実行する。 */
async function drawFrame(time: number) {
  now = time

  const callbacks = [...frames.values()]
  frames.clear()

  callbacks.forEach(callback => callback(time))
  await nextTick()
}

describe('実際のVuetify入力から個別描画までの接続', () => {
  it.each([false, true])('speed・orbitのON/OFFと再再生を反映する（保存値から復元=%s）', async restored => {
    const { wrapper: view, input, start, stop } = setup(restored)
    const tap = view.getComponent(Note).get('.note').element as HTMLElement
    const long = view.getComponent(LongNote)
    const root = long.get('.note').element as HTMLElement

    expect((input.element as HTMLInputElement).checked).toBe(restored)

    await input.setValue(true)
    expect(tap.style.transform).toBe('')

    await start.trigger('click')
    await drawFrame(2500)

    expect(tap.style.transform).toBe('translate3d(46.875px, -300px, 0)')
    expect(root.style.transform).toBe('translate3d(15.625px, -100px, 0)')
    expect(view.getComponent(Note).getComponent(VMenu).vm.activatorEl).toBe(tap)
    expect(long.getComponent(VMenu).vm.activatorEl).toBe(root)

    await input.setValue(false)
    await drawFrame(3000)

    expect(tap.style.transform).toBe('')
    expect(root.style.transform).toBe('')

    await input.setValue(true)
    expect(tap.style.transform).toBe('translate3d(31.25px, -200px, 0)')

    await stop.trigger('click')
    expect(tap.style.transform).toBe('')
    expect(root.style.transform).toBe('')

    await start.trigger('click')
    await drawFrame(5500)
    expect(tap.style.transform).toBe('translate3d(46.875px, -300px, 0)')

    view.unmount()
    wrapper = undefined

    expect(tap.style.transform).toBe('')
  })
})
