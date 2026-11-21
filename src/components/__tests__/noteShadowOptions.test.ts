import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { ExtendedNoteData, Measure } from '@/types'
import {
  cancelNoteKey,
  deleteNotesKey,
  setAppendNoteInfoKey,
  showSnackbarKey,
} from '@/composables/injectionKeys'
import NoteShadow from '../NoteShadow.vue'
import Note from '../Note.vue'

/** テストごとの差分だけを指定して、描画検証用のノーツを作成する。 */
function createNote(overrides: Partial<ExtendedNoteData> = {}): ExtendedNoteData {
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

/** 小節ごとに異なる高さを持つテスト用の小節情報。テクスチャ高さの参照先確認に使う。 */
const testMeasures: Measure[] = [
  {
    measure: 0,
    measureHeight: 200,
    measurePositionBottom: 0,
    measureBpm: 120,
    measureBeat: 2,
    measureLength: 1000,
    measureReachTime: 0,
  },
  {
    measure: 1,
    measureHeight: 400,
    measurePositionBottom: 200,
    measureBpm: 120,
    measureBeat: 4,
    measureLength: 2000,
    measureReachTime: 1000,
  },
]

/** Vuetifyのコンテナ類を最小限の要素へ置き換えるスタブ。 */
const layoutStub = defineComponent({
  setup: (_, { slots }) => () => h('div', slots.default?.()),
})

/** v-menu / v-tooltip の activator スロットをそのまま展開するスタブ。 */
const activatorStub = defineComponent({
  setup: (_, { slots }) => () => h('div', [
    slots.activator?.({ props: {} }),
    slots.default?.(),
  ]),
})

/** disabled な v-textarea の表示値をテストから確認できるようにするスタブ。 */
const textareaStub = defineComponent({
  props: ['modelValue', 'disabled'],
  setup: props => () => h('textarea', {
    value: props.modelValue,
    disabled: props.disabled,
  }),
})

/** テストで共通利用する Vuetify スタブ一覧。 */
const stubs = {
  'v-icon': layoutStub,
  'v-textarea': textareaStub,
  'v-menu': activatorStub,
  'v-tooltip': activatorStub,
  'v-card': layoutStub,
  'v-list': layoutStub,
  'v-list-item': layoutStub,
  'v-card-text': layoutStub,
  'v-card-actions': layoutStub,
  'v-row': layoutStub,
  'v-col': layoutStub,
  'v-spacer': layoutStub,
  'v-text-field': layoutStub,
  'v-select': layoutStub,
  'v-radio-group': layoutStub,
  'v-radio': layoutStub,
  'v-btn': layoutStub,
}

let wrapper: VueWrapper | undefined

/** NoteShadow を必要な provide 付きでマウントする。 */
function mountShadow(note: ExtendedNoteData, isPreAppend = false) {
  wrapper = mount(NoteShadow, {
    props: {
      note,
      measureData: testMeasures,
      isPreAppend,
    },
    global: {
      stubs,
      provide: {
        [cancelNoteKey as symbol]: vi.fn(),
      },
    },
  })

  return wrapper
}

/** 挿入後の Note を必要な provide 付きでマウントする。 */
function mountNote(note: ExtendedNoteData) {
  const measure = testMeasures[note.measure] ?? testMeasures[0]

  wrapper = mount(Note, {
    props: {
      note,
      measure,
      currentChart: [note],
    },
    global: {
      stubs,
      provide: {
        [deleteNotesKey as symbol]: vi.fn(),
        [setAppendNoteInfoKey as symbol]: vi.fn(),
        [showSnackbarKey as symbol]: vi.fn(),
      },
    },
  })

  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('NoteShadow の option 配列解釈', () => {
  it.each([
    ['左フリック初期値', { type: 3, option: ['-1'] }],
    ['右フリック幅・オフセット指定', { type: 4, option: ['3', '1', '2'] }],
    ['上フリック初期値', { type: 6, option: ['-1'] }],
    ['下フリック幅指定', { type: 7, option: ['2'] }],
    ['テクスチャ初期値', { type: 94, option: ['texture/202020.png', '2', '0.5'] }],
    ['区切り線初期値', { type: 95, option: ['5'] }],
    ['LED制御', { type: 96, lane: -1 as const, option: ['255', '81', '81'] }],
    ['瞬間移動', { type: 93, lane: -1 as const, option: ['4'] }],
    ['拍子変化', { type: 97, lane: -1 as const, option: ['3'] }],
    ['BPM変化', { type: 98, lane: -1 as const, option: ['180'] }],
    ['特殊オブジェクト', { type: 91, lane: -1 as const, option: ['2', '3'] }],
    ['コメント（数値文字列）', { type: 100, lane: -1 as const, option: ['2', '3'] }],
    ['ダミー通常（既定値）', { type: 90, option: ['1'] }],
    ['ダミーフリック（幅のみ）', { type: 90, option: ['3', '-1', '1', '2'] }],
  ])('%s では speed・orbit 以外の option をバッジ表示しない', (_, overrides) => {
    const target = createNote(overrides)

    const shadow = mountShadow(target)

    expect(shadow.find('.speed').exists()).toBe(false)
    expect(shadow.find('.orbit').exists()).toBe(false)
  })

  it.each([
    ['通常ノーツ', { type: 1, option: ['1.5', '-0.5'] }, 'x1.5', '>-0.5'],
    ['ロング始点', { type: 2, option: ['2', '1'] }, 'x2', '>1'],
    ['左フリック', { type: 3, option: ['3', '1', '2', '2', '-1.5'] }, 'x2', '>-1.5'],
    ['下フリック', { type: 7, option: ['-1', '0', '1', '0.5', '2'] }, 'x0.5', '>2'],
    ['テクスチャ', { type: 94, option: ['texture/202020.png', '2', '0.5', '1', '2', '0.5', '1.2'] }, 'x0.5', '>1.2'],
    ['区切り線', { type: 95, option: ['5', '2', '-0.5'] }, 'x2', '>-0.5'],
    ['ダミー通常', { type: 90, option: ['1', '1.5', '-0.5'] }, 'x1.5', '>-0.5'],
    ['ダミーロング', { type: 90, option: ['2', '2', '1'] }, 'x2', '>1'],
    ['ダミーフリック', { type: 90, option: ['3', '2', '1', '2', '0.5', '-1'] }, 'x0.5', '>-1'],
  ])('%s では種別ごとの添字から speed・orbit を表示する', (_, overrides, expectedSpeed, expectedOrbit) => {
    const target = createNote(overrides)

    const shadow = mountShadow(target)

    expect(shadow.get('.speed').text()).toBe(expectedSpeed)
    expect(shadow.get('.orbit').text()).toBe(expectedOrbit)
  })

  it('音札ノーツとダミー音札では speed のみ表示し orbit は表示しない', () => {
    const otofuda = createNote({ type: 5, lane: 3, option: ['2', '3'] })

    const shadow = mountShadow(otofuda)

    expect(shadow.get('.speed').text()).toBe('x2')
    expect(shadow.find('.orbit').exists()).toBe(false)

    shadow.unmount()

    const dummyOtofuda = createNote({ type: 90, lane: 3, option: ['5', '2', '3'] })

    const dummyShadow = mountShadow(dummyOtofuda)

    expect(dummyShadow.get('.speed').text()).toBe('x2')
    expect(dummyShadow.find('.orbit').exists()).toBe(false)
  })

  it('speed が 0 のときは x0 を表示し、入力途中の非数値では NaN を表示しない', () => {
    const zeroSpeed = createNote({ type: 1, option: ['0', ''] })

    const zeroShadow = mountShadow(zeroSpeed)

    expect(zeroShadow.get('.speed').text()).toBe('x0')
    expect(zeroShadow.find('.orbit').exists()).toBe(false)

    zeroShadow.unmount()

    const editing = createNote({ type: 1, option: ['-', 'abc'] })

    const editingShadow = mountShadow(editing)

    expect(editingShadow.find('.speed').exists()).toBe(false)
    expect(editingShadow.find('.orbit').exists()).toBe(false)
  })

  it.each([
    ['特殊オブジェクト', { type: 91, lane: -1 as const, option: ['obj'] }, 'SpObj'],
    ['譜面停止', { type: 92, lane: -1 as const, option: [] }, 'STOP'],
    ['瞬間移動', { type: 93, lane: -1 as const, option: ['4'] }, 'WARP 4'],
    ['拍子変化', { type: 97, lane: -1 as const, option: ['3'] }, 'BEAT 3'],
    ['BPM変化', { type: 98, lane: -1 as const, option: ['180'] }, 'BPM 180'],
    ['EOF', { type: 99, lane: -1 as const, option: [] }, 'EOF'],
  ])('制御・特殊ノーツ（%s）でも挿入後と同じラベルを表示する', (_, overrides, expectedLabel) => {
    const target = createNote(overrides)

    const shadow = mountShadow(target)

    expect(shadow.get('.note').text()).toContain(expectedLabel)
  })

  it('テクスチャは対象小節の高さを基準にし、ダミー擬態でも drawOptions を参照する', () => {
    const textureInFirstMeasure = createNote({
      type: 94,
      measure: 0,
      option: ['texture/202020.png', '2', '0.5'],
    })

    const shadow = mountShadow(textureInFirstMeasure)
    const img = shadow.get('img')

    expect(img.attributes('src')).toBe('https://db.otofuda.com/texture/202020.png')
    expect(img.attributes('style')).toContain('height: 100px')

    shadow.unmount()

    // 存在しない先の小節では末尾小節（height: 400）へフォールバックする。
    const dummyTextureBeyondEnd = createNote({
      type: 90,
      measure: 5,
      option: ['94', 'https://example.com/a.png', '1', '0.25'],
    })

    const dummyShadow = mountShadow(dummyTextureBeyondEnd)
    const dummyImg = dummyShadow.get('img')

    expect(dummyImg.attributes('src')).toBe('https://example.com/a.png')
    expect(dummyImg.attributes('style')).toContain('height: 100px')
  })

  it('ダミー経由のコメントと LED 制御でも drawOptions を参照する', () => {
    const dummyComment = createNote({
      type: 90,
      lane: -1,
      option: ['100', 'ダミーコメント'],
    })

    const commentShadow = mountShadow(dummyComment)

    expect((commentShadow.get('textarea').element as HTMLTextAreaElement).value).toBe('ダミーコメント')

    commentShadow.unmount()

    const dummyLed = createNote({
      type: 90,
      lane: -1,
      option: ['96', '10', '20', '30'],
    })

    const ledShadow = mountShadow(dummyLed)

    expect(ledShadow.get('.note').attributes('style')).toContain('rgb(10, 20, 30)')
  })

  it('フリックとテクスチャのオフセット分母が 0 でも Infinity にならない', () => {
    const flick = createNote({
      type: 3,
      lane: 3,
      option: ['3', '1', '0'],
    })

    const flickShadow = mountShadow(flick)

    // lane 3 中心(150) - 幅3の半分(90) + 小節余白(60) = 120px
    expect(flickShadow.get('.note').attributes('style')).toContain('left: 120px')

    flickShadow.unmount()

    const texture = createNote({
      type: 94,
      lane: 2,
      option: ['texture/202020.png', '1', '0.25', '1', '0'],
    })

    const textureShadow = mountShadow(texture)

    // lane 2 中心(90) - 幅1の半分(30) + 小節余白(60) = 120px
    expect(textureShadow.get('.note').attributes('style')).toContain('left: 120px')
  })

  it('単体の通常ノーツは option[3] で幅を変えず、ロング終点のみ幅を反映する', () => {
    const standaloneTap = createNote({
      type: 1,
      lane: 3,
      option: ['1', '0', 'linear', '2'],
    })

    const tapShadow = mountShadow(standaloneTap)
    const tapStyle = tapShadow.get('.note').attributes('style')

    expect(tapStyle).toContain('width: 60px')
    expect(tapStyle).toContain('left: 180px')

    tapShadow.unmount()

    const longWithWideEnd = createNote({
      type: 2,
      lane: 3,
      option: [],
      end: [
        createNote({
          type: 1,
          lane: 3,
          measure: 0,
          position: 3,
          split: 4,
          option: ['1', '0', 'linear', '2'],
        }),
      ],
    })

    const longShadow = mountShadow(longWithWideEnd)
    const notes = longShadow.findAll('.note')
    const endpointStyle = notes[1].attributes('style')

    expect(endpointStyle).toContain('width: 120px')
    expect(endpointStyle).toContain('left: 150px')
  })
})

describe('Note と NoteShadow の speed・orbit 一貫性', () => {
  it('Note.vue でも getNoteMotion に基づいて x0 を表示し、非数値では NaN を出さない', () => {
    const zeroSpeed = createNote({ type: 3, option: ['-1', '0', '1', '0', '1.5'] })

    const noteWrapper = mountNote(zeroSpeed)

    expect(noteWrapper.get('.speed').text()).toBe('x0')
    expect(noteWrapper.get('.orbit').text()).toBe('>1.5')

    noteWrapper.unmount()

    const invalid = createNote({ type: 1, option: ['abc', 'xyz'] })

    const invalidWrapper = mountNote(invalid)

    expect(invalidWrapper.find('.speed').exists()).toBe(false)
    expect(invalidWrapper.find('.orbit').exists()).toBe(false)
  })
})
