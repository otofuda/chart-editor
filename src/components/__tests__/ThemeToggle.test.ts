import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createVuetify } from 'vuetify'
import ThemeToggle from '../ThemeToggle.vue'
import { loadThemePreference } from '../../composables/useThemePreference'

const VBtn = defineComponent({
  setup(_, { attrs, slots }) {
    return () => h('button', attrs, slots.default?.())
  },
})

describe('テーマ設定', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('未設定または不正な設定ではライトを使う', () => {
    expect(loadThemePreference()).toBe('light')
    localStorage.setItem('chart-editor__theme', 'system')
    expect(loadThemePreference()).toBe('light')
  })

  it('切り替えをテーマと保存設定に反映し、次回も復元する', async () => {
    const vuetify = createVuetify({
      components: { VBtn },
      theme: { defaultTheme: loadThemePreference() },
    })
    const wrapper = mount(ThemeToggle, { global: { plugins: [vuetify] } })
    const button = wrapper.get('button')

    expect(button.attributes('aria-label')).toBe('ダークモード')
    expect(button.attributes('aria-pressed')).toBe('false')
    expect(button.text()).toContain('オフ')
    await button.trigger('click')
    expect(vuetify.theme.name.value).toBe('dark')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.text()).toContain('オン')
    expect(loadThemePreference()).toBe('dark')

    await button.trigger('click')
    expect(vuetify.theme.name.value).toBe('light')
    expect(loadThemePreference()).toBe('light')
    wrapper.unmount()
  })

  it('ブラウザの保存領域が使えなくても切り替えられる', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('unavailable') })
    const vuetify = createVuetify({
      components: { VBtn },
      theme: { defaultTheme: loadThemePreference() },
    })
    const wrapper = mount(ThemeToggle, { global: { plugins: [vuetify] } })

    await wrapper.get('button').trigger('click')
    expect(vuetify.theme.name.value).toBe('dark')
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })
})
