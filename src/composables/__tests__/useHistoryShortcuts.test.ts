import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { handleHistoryShortcut, useHistoryShortcuts } from '../useHistoryShortcuts'

afterEach(() => { document.body.innerHTML = '' })

function dispatch(key: string, init: KeyboardEventInit = {}, tag = 'div', editable = false) {
  const actions = { undo: vi.fn(), redo: vi.fn(), saveBackup: vi.fn() }
  const target = document.createElement(tag)
  if (editable) target.setAttribute('contenteditable', 'true')
  document.body.append(target)
  const event = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true, ...init })
  target.addEventListener('keydown', value => handleHistoryShortcut(value as KeyboardEvent, actions))
  target.dispatchEvent(event)
  return { actions, event }
}

describe('履歴ショートカット', () => {
  it.each([
    ['z', {}, 'undo'],
    ['Z', {}, 'undo'],
    ['z', { ctrlKey: false, metaKey: true }, 'undo'],
    ['y', {}, 'redo'],
    ['z', { shiftKey: true }, 'redo'],
    ['Z', { ctrlKey: false, metaKey: true, shiftKey: true }, 'redo'],
  ] as const)('%s %jで%sを呼ぶ', (key, init, action) => {
    const { actions, event } = dispatch(key, init)
    expect(actions[action]).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it.each(['input', 'textarea', 'select'])('%s内の文字編集を妨げない', tag => {
    const { actions, event } = dispatch('z', {}, tag)
    expect(actions.undo).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('contenteditableとその子でも標準Undoを妨げない', () => {
    const { actions, event } = dispatch('y', {}, 'div', true)
    expect(actions.redo).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    const child = document.createElement('span')
    document.body.lastElementChild!.append(child)
    child.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
    expect(actions.undo).not.toHaveBeenCalled()
  })

  it.each([{ isComposing: true }, { keyCode: 229 }, { altKey: true }, { ctrlKey: false }])(
    'IME・別の修飾キー %jでは操作しない', init => {
      const { actions, event } = dispatch('z', init)
      expect(actions.undo).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
    })

  it('処理済みイベントを再実行しない', () => {
    const actions = { undo: vi.fn(), redo: vi.fn(), saveBackup: vi.fn() }
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true })
    event.preventDefault()
    handleHistoryShortcut(event, actions)
    expect(actions.undo).not.toHaveBeenCalled()
  })

  it('入力中でも既存のCtrl+Sバックアップを維持する', () => {
    const { actions, event } = dispatch('s', {}, 'input')
    expect(actions.saveBackup).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it('アンマウント時にリスナーを解除し、再マウントで重複しない', () => {
    const actions = { undo: vi.fn(), redo: vi.fn(), saveBackup: vi.fn() }
    const host = defineComponent({ setup() { useHistoryShortcuts(actions); return () => h('div') } })
    const first = mount(host)
    first.unmount()
    const second = mount(host)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    expect(actions.undo).toHaveBeenCalledOnce()
    second.unmount()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    expect(actions.undo).toHaveBeenCalledOnce()
  })
})
