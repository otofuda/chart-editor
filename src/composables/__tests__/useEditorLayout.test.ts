import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useEditorLayout } from '../useEditorLayout'

afterEach(() => vi.unstubAllGlobals())

/** 画面幅の変更通知と、コンポーネントの再生成を検証する環境を作る。 */
function setup(width: number) {
  let change: (() => void) | undefined
  const media = {
    matches: width < 768,
    addEventListener: vi.fn((_: string, callback: () => void) => {
      change = callback
    }),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('innerWidth', width)
  vi.stubGlobal('matchMedia', vi.fn(() => media))
  let state!: ReturnType<typeof useEditorLayout>
  const component = defineComponent({
    setup() {
      state = useEditorLayout()
      return () => h('div')
    },
  })
  const wrapper = mount(component)
  return {
    get state() {
      return state
    },
    wrapper,
    component,
    media,
    resize(width: number) {
      media.matches = width < 768
      change?.()
    },
  }
}

describe('エディターのレイアウト選択', () => {
  it.each([375, 420, 767, 768, 1280])('幅 %i の自動判定と手動選択の優先', async width => {
    const { state, wrapper, resize } = setup(width)
    expect(state.preference.value).toBe('auto')
    expect(state.layout.value).toBe(width < 768 ? 'stacked' : 'side-by-side')
    state.preference.value = 'side-by-side'
    resize(375)
    expect(state.layout.value).toBe('side-by-side')
    expect(state.contained.value).toBe(true)
    state.preference.value = 'stacked'
    resize(1280)
    expect(state.layout.value).toBe('stacked')
    state.preference.value = 'auto'
    expect(state.layout.value).toBe('side-by-side')
    expect(state.contained.value).toBe(false)
    resize(767)
    expect(state.layout.value).toBe('stacked')
    resize(768)
    expect(state.layout.value).toBe('side-by-side')
    await nextTick()
    wrapper.unmount()
  })

  it('再生成で自動に戻り、画面幅の監視を解除する', () => {
    const environment = setup(1280)
    const { state, wrapper, component, media } = environment
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    state.preference.value = 'stacked'
    expect(storage).not.toHaveBeenCalled()
    wrapper.unmount()
    expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    const fresh = mount(component)
    expect(environment.state.preference.value).toBe('auto')
    expect(environment.state.layout.value).toBe('side-by-side')
    fresh.unmount()
    storage.mockRestore()
  })
})
