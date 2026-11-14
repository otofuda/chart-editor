import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, withDirectives } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VTextField } from 'vuetify/components/VTextField'
import { useChartData } from '../../composables/useChartData'
import { vHistoryField } from '../../composables/useHistoryField'
import { useHistoryShortcuts } from '../../composables/useHistoryShortcuts'
import HistoryControls from '../HistoryControls.vue'

let wrapper: VueWrapper | undefined
beforeEach(() => {
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
  vi.unstubAllGlobals()
})

describe('Vuetify入力欄と譜面履歴の接続', () => {
  it('実際のVTextFieldで連続入力をまとめ、入力中のCtrl+Zを横取りしない', async () => {
    const data = useChartData()
    const host = defineComponent({
      setup() {
        useHistoryShortcuts({ undo: data.history.undo, redo: data.history.redo, saveBackup: vi.fn() })
        return () => h('div', [
          withDirectives(h(VTextField, {
            label: 'BPM', modelValue: data.chartObject.value.info.bpm,
            'onUpdate:modelValue': value => { data.chartObject.value.info.bpm = Number(value) },
          }), [[vHistoryField, { history: data.history, meta: { label: 'BPMを変更', difficulties: [] } }]]),
          h(HistoryControls, { history: data.history, onUndo: data.history.undo, onRedo: data.history.redo }),
          h('button', { id: 'outside' }, '譜面へ戻る'),
        ])
      },
    })
    wrapper = mount(host, { attachTo: document.body, global: { plugins: [createVuetify()] } })
    const input = wrapper.get('input')
    ;(input.element as HTMLInputElement).focus()
    await input.setValue('160')
    await input.setValue('180')
    expect(data.chartObject.value.info.bpm).toBe(180)
    expect(data.history.entries.value).toHaveLength(0)
    expect(data.history.canUndo.value).toBe(true)
    const nativeUndo = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })
    input.element.dispatchEvent(nativeUndo)
    expect(nativeUndo.defaultPrevented).toBe(false)
    expect(data.chartObject.value.info.bpm).toBe(180)
    ;(wrapper.get('#outside').element as HTMLButtonElement).focus()
    await nextTick()
    expect(data.history.entries.value).toHaveLength(1)
    const chartUndo = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })
    wrapper.get('#outside').element.dispatchEvent(chartUndo)
    await nextTick()
    expect(chartUndo.defaultPrevented).toBe(true)
    expect(data.chartObject.value.info.bpm).toBe(120)
    expect((input.element as HTMLInputElement).value).toBe('120')
    await wrapper.get('[data-testid="redo"]').trigger('click')
    expect(data.chartObject.value.info.bpm).toBe(180)
  })
})
