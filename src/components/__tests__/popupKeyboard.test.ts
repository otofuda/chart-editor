import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import type { ExtendedNoteData, Measure } from '../../types'
import { deleteNotesKey, setAppendNoteInfoKey, showSnackbarKey } from '../../composables/injectionKeys'
import Note from '../Note.vue'
import LongNote from '../LongNote.vue'

const measure: Measure = {
  measure: 0, measureBeat: 4, measureBpm: 120, measureHeight: 400,
  measureLength: 1000, measurePositionBottom: 0, measureReachTime: 100,
}

function makeNote(overrides: Partial<ExtendedNoteData> = {}): ExtendedNoteData {
  return { index: 1, type: 1, lane: 1, measure: 0, position: 1, split: 4, option: [], end: [], ...overrides }
}

const layout = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
const textField = defineComponent({
  props: ['label', 'modelValue'],
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('input', {
    'aria-label': props.label, value: props.modelValue,
    onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
  }),
})

function setup(component: typeof Note | typeof LongNote, note: ExtendedNoteData) {
  const listKeydown = vi.fn((event: KeyboardEvent) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      ;(event.currentTarget as HTMLElement).focus()
    }
  })
  const stubs = {
    ...Object.fromEntries([
      'v-row', 'v-col', 'v-spacer', 'v-alert', 'v-card', 'v-list-item', 'v-card-title',
      'v-card-text', 'v-divider', 'v-card-actions', 'v-radio-group', 'v-radio', 'v-icon', 'v-tooltip', 'v-textarea',
    ].map(name => [name, layout])),
    'v-list': defineComponent({ setup: (_, { slots }) => () => h('div', { tabindex: 0, onKeydown: listKeydown }, slots.default?.()) }),
    'v-text-field': textField,
    'v-select': textField,
    'v-combobox': textField,
    'v-btn': defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }),
    'v-menu': defineComponent({
      props: ['modelValue'], emits: ['update:modelValue'],
      setup: (props, { emit, slots }) => () => h('div', [
        slots.activator?.({ props: { onClick: () => emit('update:modelValue', !props.modelValue) } }),
        slots.default?.(),
      ]),
    }),
  }
  const wrapper = mount(component, {
    attachTo: document.body,
    props: component === Note ? { note, measure, currentChart: [note] } : { note, measureData: [measure] },
    global: {
      stubs,
      provide: {
        [deleteNotesKey as symbol]: vi.fn(),
        [setAppendNoteInfoKey as symbol]: vi.fn(),
        [showSnackbarKey as symbol]: vi.fn(),
      },
    },
  })
  return { wrapper, listKeydown }
}

function keydown(input: HTMLInputElement, key: string) {
  input.focus()
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  input.dispatchEvent(event)
  return event
}

describe('譜面ポップアップのキー操作', () => {
  it('通常ノートのすべての数値欄で上下キーをリストに渡さず、標準操作を妨げない', async () => {
    const { wrapper, listKeydown } = setup(Note, makeNote())
    try {
      await wrapper.get('.note').trigger('click')
      const inputs = wrapper.findAll('input[type="number"]')
      expect(inputs).toHaveLength(6) // 小節、position、split、speed、orbit、width
      for (const input of inputs) {
        for (const key of ['ArrowUp', 'ArrowDown']) {
          const element = input.element as HTMLInputElement
          const event = keydown(element, key)
          expect(event.defaultPrevented).toBe(false)
          expect(document.activeElement).toBe(element)
        }
      }
      expect(listKeydown).not.toHaveBeenCalled()
      const element = inputs[1].element as HTMLInputElement
      keydown(element, 'Tab')
      keydown(element, 'Enter')
      expect(listKeydown.mock.calls.map(([event]) => event.key)).toEqual(['Tab', 'Enter'])
      const select = wrapper.get('input[aria-label="ノート種別"]').element as HTMLInputElement
      expect(keydown(select, 'ArrowDown').defaultPrevented).toBe(true)
      expect(listKeydown).toHaveBeenCalledTimes(3)
    } finally { wrapper.unmount() }
  })

  it('ロングノートの始点と再帰した終点の数値欄を守り、終点positionの移動を維持する', async () => {
    const child = makeNote({ position: 2 })
    const end = makeNote({ position: 1, end: [child] })
    const root = makeNote({ type: 2, position: 0, end: [end] })
    const { wrapper, listKeydown } = setup(LongNote, root)
    try {
      await wrapper.get('.note').trigger('click')
      const inputs = wrapper.findAll('input[type="number"]')
      expect(inputs.length).toBe(15) // 始点5欄、終点とその子が各5欄
      for (const input of inputs) {
        for (const key of ['ArrowUp', 'ArrowDown']) {
          const element = input.element as HTMLInputElement
          expect(keydown(element, key).defaultPrevented).toBe(false)
          expect(document.activeElement).toBe(element)
        }
      }
      const positions = wrapper.findAll('input[aria-label="position"]')
      expect(positions).toHaveLength(3)
      const childPosition = positions[2].element as HTMLInputElement
      expect(keydown(childPosition, 'ArrowUp').defaultPrevented).toBe(false)
      expect(child.position).toBe(3)
      expect(document.activeElement).toBe(childPosition)
      keydown(childPosition, 'ArrowDown')
      expect(child.position).toBe(2)
      expect(listKeydown).not.toHaveBeenCalled()
    } finally { wrapper.unmount() }
  })
})
