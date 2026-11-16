import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VMenu } from 'vuetify/components/VMenu'
import type { ExtendedNoteData, Measure } from '../../types'
import {
  deleteNotesKey,
  setAppendNoteInfoKey,
  showSnackbarKey,
} from '../../composables/injectionKeys'
import Note from '../Note.vue'
import LongNote from '../LongNote.vue'
import { createPreviewNoteMotion, motionSourceKey } from '../../composables/usePreviewNoteMotion'

const measure: Measure = {
  measure: 0,
  measureBeat: 4,
  measureBpm: 120,
  measureHeight: 400,
  measureLength: 1000,
  measurePositionBottom: 0,
  measureReachTime: 100,
}

/**
 * 配置確認に使うノーツを生成する。
 *
 * @param overrides - 種別や終点など、検証ケースごとに変更する値。
 * @returns 指定した値を反映した検証用ノーツ。
 */
const note = (overrides: Partial<ExtendedNoteData> = {}): ExtendedNoteData => ({
  index: 1,
  type: 1,
  lane: 1,
  measure: 0,
  position: 1,
  split: 4,
  option: [],
  end: [],
  ...overrides,
})

/** 配置確認に不要な装飾コンポーネントを、子要素だけ描画する要素へ置き換える。 */
const layout = defineComponent({
  setup: (_, { slots }) => () => h('div', slots.default?.()),
})

let wrapper: VueWrapper | undefined
let contentHeight = 1000

beforeEach(() => {
  contentHeight = 1000
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
  vi.stubGlobal('visualViewport', undefined)
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1600)
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(900)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function () {
    return this.classList.contains('v-overlay__content') ? contentHeight : 0
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/**
 * 実際のVMenuとノーツを描画し、譜面の表示位置を変更できる状態にする。
 *
 * @param long - ロングノーツを検証する場合はtrue。
 * @param motion - 個別のspeedとorbitを持つノーツで検証する場合はtrue。
 * @returns 描画したコンポーネントと、譜面の左端を指定する矩形情報。
 */
function setup(long = false, motion = false) {
  const data = long
    ? note({
      type: 2,
      position: 0,
      end: [
        note({
          position: 1,
          end: [note({ position: 2 })],
        }),
      ],
    })
    : note()

  if (motion) {
    data.option = ['2', '1']
  }

  const renderer = createPreviewNoteMotion()

  const host = defineComponent({
    setup: () => () => h('div', { class: 'preview' }, [
      long
        ? h(LongNote, {
          note: data,
          measureData: [measure],
        })
        : h(Note, {
          note: data,
          measure,
          currentChart: [data],
        }),
    ]),
  })

  wrapper = mount(host, {
    attachTo: document.body,
    global: {
      plugins: [createVuetify()],
      components: { VMenu },
      stubs: {
        ...Object.fromEntries([
          'v-card', 'v-list', 'v-list-item', 'v-card-text', 'v-card-title', 'v-card-actions',
          'v-row', 'v-col', 'v-radio-group', 'v-radio', 'v-spacer', 'v-icon', 'v-tooltip',
          'v-select', 'v-combobox', 'v-divider', 'v-alert', 'v-textarea',
        ].map(name => [name, layout])),
        'v-text-field': defineComponent({
          setup: () => () => h('input'),
        }),
        'v-btn': defineComponent({
          setup: (_, { slots }) => () => h('button', slots.default?.()),
        }),
      },
      provide: {
        [deleteNotesKey as symbol]: vi.fn(),
        [setAppendNoteInfoKey as symbol]: vi.fn(),
        [showSnackbarKey as symbol]: vi.fn(),
        [motionSourceKey as symbol]: renderer.register,
      },
    },
  })

  const geometry = { left: 1000 }

  vi.spyOn(wrapper.get('.preview').element, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(geometry.left, 0, 420, 3000),
  )

  return { wrapper, geometry, renderer }
}

/** Vueの描画更新と、Vuetify内部の非同期処理の完了を待つ。 */
async function settle() {
  await nextTick()
  await flushPromises()
}

describe('実際のVuetifyメニューの配置', () => {
  it.each([false, true])('個別描画とメニューが同じノーツ要素を参照できる（ロング=%s）', async long => {
    const { wrapper, renderer } = setup(long, true)
    const target = wrapper.get('.note').element as HTMLElement

    try {
      await settle()

      renderer.configure({ beatHeight: 100, bpm: 120, viewportHeight: 900, lift: 0, drawOffset: 0 })
      renderer.update(-100)

      expect(wrapper.getComponent(VMenu).vm.activatorEl).toBe(target)
      expect(target.style.transform).toBe(long
        ? 'translate3d(15.625px, -100px, 0)'
        : 'translate3d(31.25px, -200px, 0)')

      await wrapper.get('.note').trigger('click')
      await settle()

      expect(wrapper.getComponent(VMenu).props('modelValue')).toBe(true)
      expect(wrapper.getComponent(VMenu).props('target')).toBe(target)
    } finally {
      renderer.reset()
    }

    expect(target.style.transform).toBe('')
  })

  it.each([
    [false, '.note', 240],
    [true, '.note', 420],
    [true, '.note-midpoint', 420],
    [true, '.note.type1', 420],
    [true, '.long-note-svg g', 420],
  ] as const)('ロング=%s・%sから開き、幅%iで譜面の左外側に収める', async (long, selector, width) => {
    const { wrapper } = setup(long)
    const target = wrapper.get(selector)
    vi.spyOn(target.element, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(1200, 600, 60, 4),
    )
    target.element.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      detail: 1,
      clientY: 602,
    }))
    await settle()
    expect(wrapper.findComponent(VMenu).props('target')).toBe(target.element)
    const content = document.querySelector<HTMLElement>(
      '.v-overlay--active .v-overlay__content',
    )!
    expect(content).not.toBeNull()
    expect(content.style.left).toBe(`${1000 - width - 12}px`)
    expect(content.style.width).toBe(`${width}px`)
    expect(content.style.top).toBe('12px')
    expect(content.style.maxHeight).toBe('876px')
  })

  it('開いたまま狭い画面と広い画面を行き来しても配置スタイルを持ち越さない', async () => {
    const { wrapper, geometry } = setup()
    await wrapper.get('.note').trigger('click')
    await settle()
    const content = document.querySelector<HTMLElement>(
      '.v-overlay--active .v-overlay__content',
    )!
    expect(content.style.width).toBe('240px')
    geometry.left = 200
    window.dispatchEvent(new Event('resize'))
    await settle()
    expect(wrapper.findComponent(VMenu).props('locationStrategy')).toBe('connected')
    expect(content.style.width).toBe('')
    geometry.left = 1000
    window.dispatchEvent(new Event('resize'))
    await settle()
    expect(content.style.left).toBe('748px')
    expect(content.style.width).toBe('240px')
  })

  it('帯の途中のクリック位置を使い、画面の高さを変えても上下に収める', async () => {
    contentHeight = 200
    const { wrapper } = setup(true)
    const band = wrapper.get('.long-note-svg g')
    vi.spyOn(band.element, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(1100, 100, 60, 700),
    )
    band.element.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      detail: 1,
      clientY: 600,
    }))
    await settle()
    const content = document.querySelector<HTMLElement>(
      '.v-overlay--active .v-overlay__content',
    )!
    expect(content.style.top).toBe('600px')
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(600)
    window.dispatchEvent(new Event('resize'))
    await settle()
    expect(content.style.top).toBe('388px')
    expect(content.style.maxHeight).toBe('576px')
    expect(content.style.left).toBe('568px')
  })
})
