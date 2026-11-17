import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VDialog } from 'vuetify/components/VDialog'
import { VMenu } from 'vuetify/components/VMenu'
import App from '../../App.vue'
import Preview from '../Preview.vue'
import * as chartModule from '../../composables/useChartData'
import type { ExtendedNoteData } from '../../types'

vi.mock('vuetify', async importOriginal => ({
  ...await importOriginal<typeof import('vuetify')>(),
  useGoTo: () => vi.fn(),
}))

/** 装飾用のコンポーネントを省略し、本文・操作ボタン・閉じるボタンを描画する。 */
const layout = defineComponent({
  setup: (_, { slots }) => () => h('div', [
    slots.default?.(),
    slots.actions?.(),
    slots.append?.(),
  ]),
})

/** 入力欄の値変更を再現し、ノーツ種別だけは実際の選択欄と同じ数値で通知する。 */
const textField = defineComponent({
  props: ['label', 'modelValue', 'disabled', 'type'],
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('input', {
    'aria-label': props.label,
    value: props.modelValue,
    disabled: props.disabled,
    type: props.type,
    onInput: (event: Event) => {
      const value = (event.target as HTMLInputElement).value

      emit('update:modelValue', props.label === 'ノート種別' || props.label === 'type' ? Number(value) : value)
    },
  }),
})

/** モード切替などのチェック状態を、DOMから変更できるようにする。 */
const checkbox = defineComponent({
  props: ['label', 'modelValue', 'disabled'],
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('input', {
    'aria-label': props.label,
    type: 'checkbox',
    checked: props.modelValue,
    disabled: props.disabled,
    onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).checked),
  }),
})

/** ボタンの無効状態と標準のキーボード操作を保つため、ネイティブ要素を使う。 */
const button = defineComponent({
  props: ['disabled'],
  setup: (props, { slots }) => () => h('button', { disabled: props.disabled }, slots.default?.()),
})

/** メニュー・ダイアログ・編集状態・再生は実物を使い、装飾と譜面描画だけを置き換える。 */
const stubs = {
  ...Object.fromEntries([
    'v-app',
    'v-container',
    'v-row',
    'v-col',
    'v-spacer',
    'v-alert',
    'v-card',
    'v-list',
    'v-list-item',
    'v-list-item-title',
    'v-list-item-subtitle',
    'v-card-title',
    'v-card-text',
    'v-divider',
    'v-card-actions',
    'v-btn-group',
    'v-badge',
    'v-chip',
    'v-slider',
    'v-icon',
    'v-file-input',
    'v-color-picker',
    'v-img',
    'v-radio',
    'v-radio-group',
    'v-snackbar',
    'v-table',
    'v-tabs',
    'v-tab',
    'v-window',
    'v-window-item',
    'v-tooltip',
    'v-expansion-panels',
    'v-expansion-panel',
    'v-expansion-panel-title',
    'v-expansion-panel-text',
  ].map(name => [name, layout])),
  'v-text-field': textField,
  'v-textarea': textField,
  'v-select': textField,
  'v-combobox': textField,
  'v-checkbox': checkbox,
  'v-switch': checkbox,
  'v-btn': button,
  MeasureComponent: true,
  ObjectBasedMeasure: true,
  LongNote: true,
  NoteShadow: true,
  DensityGraph: true,
  NoteTypePie: true,
  ThemeToggle: true,
}

/** 各テストで描画したアプリ。終了時に解除し、キーリスナーを次のテストへ持ち越さない。 */
let wrapper: VueWrapper

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ contents: [] }) }))
  vi.stubGlobal('ResizeObserver', class {
    /** テストではレイアウト変化を観測しない。 */
    observe() {}

    /** 観測を登録しないため、解除も何もしない。 */
    unobserve() {}

    /** 実際の監視リソースを持たないため、終了処理も不要。 */
    disconnect() {}
  })
  vi.stubGlobal('visualViewport', undefined)
  vi.stubGlobal('scrollY', 250)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/**
 * 各ケースで必要な項目だけを指定して、検証用ノーツを作る。
 *
 * @param overrides 初期値から変更する種別・位置・選択状態など
 * @returns 譜面へ設定できるノーツデータ
 */
function note(overrides: Partial<ExtendedNoteData> = {}): ExtendedNoteData {
  return {
    index: 1,
    type: 1,
    lane: 1,
    measure: 0,
    position: 0,
    split: 8,
    option: [],
    end: [],
    ...overrides,
  }
}

/**
 * 指定した譜面をアプリに接続し、実際のメニュー・ダイアログと再生操作を使える状態にする。
 *
 * @param notes 現在の難易度へ配置するノーツ
 * @returns 選択状態や履歴を確認するための譜面データと操作
 */
function setup(notes: ExtendedNoteData[] = []) {
  const data = chartModule.useChartData()

  data.chartObject.value.easy = notes
  vi.spyOn(chartModule, 'useChartData').mockReturnValue(data)

  wrapper = mount(App, {
    attachTo: document.body,
    global: {
      plugins: [createVuetify({ components: { VMenu, VDialog } })],
      stubs,
    },
  })

  return data
}

/** Vueの描画と、Vuetifyが予約するフォーカス・メニュー状態の更新を待つ。 */
async function settle() {
  await nextTick()
  await vi.advanceTimersByTimeAsync(0)
  await nextTick()
}

/**
 * 入力先からキーイベントを送出し、画面の反映まで待つ。
 *
 * @param key 押すキーの名前
 * @param init 修飾キーや長押しなどのイベント属性
 * @param target 入力欄・ボタンなどのイベント送出先
 * @returns ブラウザの既定動作が抑止されたかを確認するためのイベント
 */
async function key(
  key: string,
  init: KeyboardEventInit = {},
  target: EventTarget = document.body,
) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })

  target.dispatchEvent(event)
  await settle()

  return event
}

/**
 * アプリ内やTeleport先から、ラベルが一致する操作ボタンを取得する。
 *
 * @param text ボタンに表示される文言
 * @param root 検索するDOM範囲。ダイアログを探す場合はdocument.bodyを渡す
 * @returns 文言に一致するボタン要素
 */
function findButton(text: string, root: ParentNode = wrapper.element) {
  const result = [...root.querySelectorAll('button')].find(button => button.textContent?.trim() === text)

  if (!result) {
    throw new Error(`Button not found: ${text}`)
  }

  return result
}

describe('画面からショートカットで編集する', () => {
  it('挿入モード外では配置せず、配置欄で仮配置・確定し、一回のUndoで戻せる', async () => {
    const data = setup()

    // モードがオフの間は、仮配置も確定挿入も行わない。
    await key('i')
    await key('Enter')
    await key('Enter', { ctrlKey: true })
    expect(data.currentChart.value).toHaveLength(0)

    // 同じposition欄のEnterとMod+Enterが、別々の操作になることを確認する。
    await key('i')
    const position = wrapper.get('[data-editor-placement] input[aria-label="position"]').element

    await key('Enter', {}, position)
    expect(wrapper.text()).toContain('仮配置：1個')
    expect(data.history.canUndo.value).toBe(false)

    await key('Enter', { ctrlKey: true }, position)
    expect(data.currentChart.value).toHaveLength(1)
    expect(wrapper.text()).toContain('仮配置：0個')
    expect(data.history.entries.value).toHaveLength(1)

    await key('z', { ctrlKey: true })
    expect(data.currentChart.value).toHaveLength(0)

    await key('z', { metaKey: true, shiftKey: true })
    expect(data.currentChart.value).toHaveLength(1)
  })

  it('再帰したロング終点欄のMod+Enterでも仮配置を追加せず確定する', async () => {
    const data = setup()

    // 終点のさらに子を作り、再帰したフォームから操作する。
    await wrapper.get('input[aria-label="ノート種別"]').setValue('2')
    findButton('ここに終点を追加').click()
    await settle()
    const positions = wrapper.findAll('[data-editor-placement] input[aria-label="position"]')
    expect(positions).toHaveLength(3)

    const leaf = positions[2].element

    await key('Enter', {}, leaf)
    expect(wrapper.text()).toContain('仮配置：1個')

    await key('Enter', { metaKey: true }, leaf)
    expect(data.currentChart.value).toHaveLength(1)
    expect(data.currentChart.value[0].end[0].end).toHaveLength(1)
    expect(wrapper.text()).toContain('仮配置：0個')
    expect(data.history.entries.value).toHaveLength(1)
  })

  it('全選択はボタンとMod+Aで同じ対象を選び、仮配置・他難易度・再生を保つ', async () => {
    const data = setup([note(), note({ index: 2, type: 100, measure: 1 })])
    data.chartObject.value.hard = [note()]

    // 既存ノーツと重ならない位置に仮配置し、全選択後も残っているかを確認する。
    await wrapper.get('[data-editor-placement] input[aria-label="position"]').setValue('1')
    await key('Enter')
    const preview = wrapper.getComponent(Preview)
    await key(' ')
    expect(preview.classes()).toContain('playing')

    const chart = data.currentChart.value
    const event = await key('a', { metaKey: true })
    expect(event.defaultPrevented).toBe(true)
    expect(chart.every(note => note.isSelected)).toBe(true)
    expect(data.currentChart.value).toBe(chart)
    expect(data.chartObject.value.hard[0].isSelected).not.toBe(true)
    expect(wrapper.text()).toContain('仮配置：1個')
    expect(data.history.canUndo.value).toBe(false)
    expect(preview.classes()).toContain('playing')

    // キー操作とボタン操作で、選択対象と再生継続の動作を揃える。
    chart.forEach(note => {
      note.isSelected = false
    })

    findButton('すべて選択').click()
    await settle()
    expect(chart.every(note => note.isSelected)).toBe(true)
    expect(preview.classes()).toContain('playing')

    const input = wrapper.get('input[aria-label="BPM"]').element
    expect((await key('a', { ctrlKey: true }, input)).defaultPrevented).toBe(false)
  })

  it('Deleteは確認だけを開き、Escで閉じても選択を保つ。削除確定は一回でUndoできる', async () => {
    const data = setup([note({ isSelected: true })])

    await key('Delete')
    expect(document.querySelector('.v-dialog.v-overlay--active')).not.toBeNull()
    expect(data.currentChart.value).toHaveLength(1)

    // 長押しでは閉じず、通常のEscでも選択解除まで続けて実行しない。
    await key('Escape', { repeat: true })
    expect(document.querySelector('.v-dialog.v-overlay--active')).not.toBeNull()
    await key('Escape')
    expect(document.querySelector('.v-dialog.v-overlay--active')).toBeNull()
    expect(data.currentChart.value[0].isSelected).toBe(true)

    await key('Delete')
    findButton('削除する', document.body).click()
    await settle()
    expect(data.currentChart.value).toHaveLength(0)
    expect(data.history.entries.value).toHaveLength(1)

    await key('z', { ctrlKey: true })
    expect(data.currentChart.value).toHaveLength(1)
    expect(data.currentChart.value[0].isSelected).toBe(false)

    await key('Delete')
    expect(document.querySelector('.v-dialog.v-overlay--active')).toBeNull()
  })

  it('Escは実際のメニューを閉じてから、次の一回で停止、その次で選択解除する', async () => {
    const data = setup([note({ isSelected: true })])

    // 再生中に実際のVMenuを開き、Escの処理順を検証する。
    await key(' ')
    const preview = wrapper.getComponent(Preview)
    await wrapper.get('input[aria-label="ノート種別"]').setValue('94')
    findButton('テクスチャをデータベースから探す').click()
    await settle()
    expect(document.querySelector('.v-menu.v-overlay--active')).not.toBeNull()
    expect((await key('a', { ctrlKey: true })).defaultPrevented).toBe(false)
    await key('Escape')
    expect(document.querySelector('.v-menu.v-overlay--active')).toBeNull()
    expect(preview.classes()).toContain('playing')
    expect(data.currentChart.value[0].isSelected).toBe(true)

    await key('Escape', {}, findButton('すべて選択'))
    expect(preview.classes()).not.toContain('playing')
    expect(data.currentChart.value[0].isSelected).toBe(true)

    await vi.advanceTimersByTimeAsync(50)
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 250, behavior: 'auto' })

    await key('Escape')
    expect(data.currentChart.value[0].isSelected).toBe(false)
  })

  it('実際のダイアログ内でもCmd+Sでバックアップし、?でガイドの追加説明を表示する', async () => {
    const data = setup([note()])

    await key('?')
    const guide = document.querySelector('.v-dialog.v-overlay--active .usage-content')!
    expect(guide.textContent).toContain('Mod+A')
    expect(guide.textContent).toContain('現在の難易度の全ノーツ・制御オブジェクト')
    expect(guide.textContent).toContain('文字の全選択')

    await key('s', { metaKey: true })
    expect(localStorage.getItem('chart-editor__backup')).not.toBeNull()
    expect(data.currentChart.value).toHaveLength(1)
  })

  it('Object表示では再生を始めず、入力・ボタンの標準キーも妨げない', async () => {
    setup()

    await wrapper.get('input[aria-label="Object表示モード"]').setValue(true)
    await key(' ')
    expect(wrapper.getComponent(Preview).classes()).not.toContain('playing')

    await wrapper.get('input[aria-label="Object表示モード"]').setValue(false)
    expect((await key(' ', {}, findButton('すべて選択'))).defaultPrevented).toBe(false)
    expect((await key('Enter', {}, wrapper.get('input[aria-label="BPM"]').element)).defaultPrevented).toBe(false)
    expect(wrapper.getComponent(Preview).classes()).not.toContain('playing')
  })
})
