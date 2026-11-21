import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import {
  handleEditorShortcut,
  handlePositionEnter,
  useEditorShortcuts,
  type EditorShortcutContext,
} from '../useEditorShortcuts'

afterEach(() => {
  document.body.innerHTML = ''
})

/**
 * 履歴操作の検証用に、Ctrlを標準の修飾キーとしてイベントを送出する。
 *
 * @param key 押すキーの名前
 * @param init 標準のCtrl操作から変更するイベント属性
 * @param tag イベントを送出する要素のタグ名
 * @param editable contenteditableとして文字編集を優先するか
 * @returns 呼び出された操作と、既定動作の抑止を確認するためのイベント
 */
function dispatch(key: string, init: KeyboardEventInit = {}, tag = 'div', editable = false) {
  const actions = { undo: vi.fn(), redo: vi.fn(), saveBackup: vi.fn() }
  const target = document.createElement(tag)

  if (editable) {
    target.setAttribute('contenteditable', 'true')
  }

  document.body.append(target)

  const event = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true, ...init })

  target.addEventListener('keydown', value => handleEditorShortcut(value as KeyboardEvent, actions))
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
    handleEditorShortcut(event, actions)
    expect(actions.undo).not.toHaveBeenCalled()
  })

  it('入力中でも既存のCtrl+Sバックアップを維持する', () => {
    const { actions, event } = dispatch('s', {}, 'input')
    expect(actions.saveBackup).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it('アンマウント時にリスナーを解除し、再マウントで重複しない', () => {
    const actions = { undo: vi.fn(), redo: vi.fn(), saveBackup: vi.fn() }
    const host = defineComponent({
      /** テスト用の画面と同じライフサイクルで、共通リスナーを登録・解除する。 */
      setup() {
        useEditorShortcuts(actions)

        return () => h('div')
      },
    })

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

/**
 * 入力先や編集状態を指定し、編集ショートカットの受付可否を検証する。
 *
 * @param key 押すキーの名前
 * @param init 修飾キー・IME・長押しなどのイベント属性
 * @param target イベントを送出する要素
 * @param context 操作の利用条件やドラッグ状態
 * @returns 各操作の呼び出し状況と、既定動作の抑止を確認するためのイベント
 */
function send(
  key: string,
  init: KeyboardEventInit = {},
  target: HTMLElement = document.createElement('div'),
  context: EditorShortcutContext = {},
) {
  const actions = {
    togglePlayback: vi.fn(),
    toggleAppendMode: vi.fn(),
    placeNotes: vi.fn(),
    appendNotes: vi.fn(),
    selectAll: vi.fn(),
    deleteSelection: vi.fn(),
    escape: vi.fn(),
    help: vi.fn(),
    saveBackup: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
  }

  if (!target.isConnected) {
    document.body.append(target)
  }

  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })

  target.addEventListener('keydown', value => handleEditorShortcut(value as KeyboardEvent, actions, context))
  target.dispatchEvent(event)

  return { actions, event }
}

describe('編集ショートカットの競合と実行条件', () => {
  it.each([
    [' ', {}, 'togglePlayback'],
    ['i', {}, 'toggleAppendMode'],
    ['I', {}, 'toggleAppendMode'],
    ['Enter', {}, 'placeNotes'],
    ['Delete', {}, 'deleteSelection'],
    ['Escape', {}, 'escape'],
    ['?', {}, 'help'],
    ['?', { shiftKey: true }, 'help'],
    ['Enter', { ctrlKey: true }, 'appendNotes'],
    ['Enter', { metaKey: true }, 'appendNotes'],
    ['a', { ctrlKey: true }, 'selectAll'],
    ['a', { metaKey: true }, 'selectAll'],
    ['s', { metaKey: true }, 'saveBackup'],
  ] as const)('%s %jで%sを一回実行する', (key, init, action) => {
    const { actions, event } = send(key, init)
    expect(actions[action]).toHaveBeenCalledOnce()
    expect(Object.values(actions).reduce((sum, mock) => sum + mock.mock.calls.length, 0)).toBe(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it.each([
    ['i', { shiftKey: true }],
    [' ', { ctrlKey: true }],
    ['a', { ctrlKey: true, shiftKey: true }],
    ['s', { ctrlKey: true, shiftKey: true }],
    ['Enter', { ctrlKey: true, metaKey: true }],
    ['Enter', { ctrlKey: true, shiftKey: true }],
    ['y', { metaKey: true }],
    ['?', { altKey: true }],
    ['a', { ctrlKey: true, isComposing: true }],
    ['Enter', { keyCode: 229 }],
  ])('余分な修飾キーやIMEを受け付けない: %s %j', (key, init) => {
    const { actions, event } = send(key as string, init as KeyboardEventInit)
    expect(Object.values(actions).every(mock => mock.mock.calls.length === 0)).toBe(true)
    expect(event.defaultPrevented).toBe(false)
  })

  it.each(['input', 'textarea', 'select', 'editable', 'editable-child', 'plaintext-only', 'combobox'])(
    '%s内では文字の全選択と単独キーを優先する', kind => {
      const root = document.createElement(
        kind === 'textarea' || kind === 'select' || kind === 'input' ? kind : 'div',
      )
      let target: HTMLElement = root

      if (kind.startsWith('editable') || kind === 'plaintext-only') {
        root.setAttribute('contenteditable', kind === 'plaintext-only' ? 'plaintext-only' : '')
      }

      if (kind === 'combobox') {
        root.setAttribute('role', 'combobox')
      }

      if (kind === 'editable-child') {
        target = document.createElement('span')
        root.append(target)
      }
      document.body.append(root)

      const { actions, event } = send('a', { ctrlKey: true }, target)

      expect(actions.selectAll).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)

      const plain = send(' ', {}, target)
      expect(plain.actions.togglePlayback).not.toHaveBeenCalled()
      expect(plain.event.defaultPrevented).toBe(false)
    },
  )

  it.each(['button', 'a', 'slider', 'checkbox', 'summary'])('%sの標準操作を優先する', kind => {
    const root = document.createElement(['button', 'a', 'summary'].includes(kind) ? kind : 'div')

    if (kind === 'a') {
      root.setAttribute('href', '#')
    }

    if (kind === 'slider' || kind === 'checkbox') {
      root.setAttribute('role', kind)
    }

    const child = document.createElement('span')
    root.append(child)
    document.body.append(root)

    for (const key of [' ', 'Enter', 'Delete', 'i', '?']) {
      const { actions, event } = send(key, {}, child)

      expect(Object.values(actions).every(mock => mock.mock.calls.length === 0)).toBe(true)
      expect(event.defaultPrevented).toBe(false)
    }
  })

  it('メニューがフォーカスを戻したボタンからでもEscで次の操作を中断できる', () => {
    const { actions, event } = send('Escape', {}, document.createElement('button'))
    expect(actions.escape).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it.each([true, false])('Mod+Enterは配置フォームの入力欄だけで確定する: 配置=%s', placement => {
    const root = document.createElement('div')

    if (placement) {
      root.setAttribute('data-editor-placement', '')
    }

    const input = document.createElement('input')
    root.append(input)
    document.body.append(root)

    const { actions, event } = send('Enter', { metaKey: true }, input)

    expect(actions.appendNotes).toHaveBeenCalledTimes(placement ? 1 : 0)
    expect(actions.placeNotes).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(placement)
  })

  it.each(['v-menu', 'v-dialog'])('%sが表示中は譜面操作を抑止し、保存は許可する', overlayClass => {
    const overlay = document.createElement('div')
    overlay.className = `${overlayClass} v-overlay--active`
    document.body.append(overlay)

    for (const [key, init] of [['Escape', {}], [' ', {}], ['a', { ctrlKey: true }], ['z', { ctrlKey: true }]] as const) {
      const { actions, event } = send(key, init)

      expect(Object.values(actions).every(mock => mock.mock.calls.length === 0)).toBe(true)
      expect(event.defaultPrevented).toBe(false)
    }

    const { actions } = send('s', { metaKey: true }, document.createElement('input'))
    expect(actions.saveBackup).toHaveBeenCalledOnce()
  })

  it('ツールチップでは操作を抑止しない', () => {
    const tooltip = document.createElement('div')
    tooltip.className = 'v-tooltip v-overlay--active'
    document.body.append(tooltip)

    expect(send('a', { ctrlKey: true }).actions.selectAll).toHaveBeenCalledOnce()
  })

  it('ドラッグ中は新規操作を始めず、既存の履歴と保存は利用できる', () => {
    const context = { isDragging: () => true }
    const { actions, event } = send(' ', {}, undefined, context)

    expect(actions.togglePlayback).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    expect(send('a', { ctrlKey: true }, undefined, context).actions.selectAll).not.toHaveBeenCalled()
    expect(send('z', { ctrlKey: true }, undefined, context).actions.undo).toHaveBeenCalledOnce()
    expect(send('s', { ctrlKey: true }, undefined, context).actions.saveBackup).toHaveBeenCalledOnce()
  })

  it('利用できない編集操作はキーを消費しない', () => {
    const { actions, event } = send('Enter', { ctrlKey: true }, undefined, { enabled: () => false })
    expect(actions.appendNotes).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it.each([
    [' ', {}],
    ['Enter', {}],
    ['Escape', {}],
    ['a', { ctrlKey: true }],
    ['s', { metaKey: true }],
  ] as const)(
    '長押しによる再実行は止め、ブラウザの既定動作も抑止する: %s', (key, init) => {
      const { actions, event } = send(key, { ...init, repeat: true })
      expect(Object.values(actions).every(mock => mock.mock.calls.length === 0)).toBe(true)
      expect(event.defaultPrevented).toBe(true)
    },
  )

  it('Undo／Redoは長押しでも実行できる', () => {
    expect(send('z', { ctrlKey: true, repeat: true }).actions.undo).toHaveBeenCalledOnce()
    expect(send('z', { metaKey: true, shiftKey: true, repeat: true }).actions.redo).toHaveBeenCalledOnce()
  })
})

describe('position欄のEnter', () => {
  it('通常Enterは仮配置を一回だけ行い、グローバル処理で再実行しない', () => {
    const place = vi.fn()
    const input = document.createElement('input')
    input.addEventListener('keydown', event => handlePositionEnter(event, place))
    const { actions, event } = send('Enter', {}, input)
    expect(place).toHaveBeenCalledOnce()
    expect(actions.placeNotes).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it.each([
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { isComposing: true },
    { keyCode: 229 },
  ])(
    '修飾キーとIMEでは仮配置しない: %j', init => {
      const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, ...init })
      const place = vi.fn()
      handlePositionEnter(event, place)
      expect(place).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
    },
  )

  it('長押しと処理済みイベントでは追加の仮配置を行わない', () => {
    const place = vi.fn()
    const repeated = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, cancelable: true })
    handlePositionEnter(repeated, place)
    const handled = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })
    handled.preventDefault()
    handlePositionEnter(handled, place)
    expect(place).not.toHaveBeenCalled()
    expect(repeated.defaultPrevented).toBe(true)
  })
})
