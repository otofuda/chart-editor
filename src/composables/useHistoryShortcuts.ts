import { onBeforeUnmount, onMounted } from 'vue'

/** キー操作から実行する譜面履歴とバックアップの処理。 */
export interface HistoryShortcuts {
  undo: () => void
  redo: () => void
  saveBackup: () => void
}

/**
 * 入力欄の標準操作やIME変換を優先し、譜面のショートカットを処理する。
 *
 * @param event - documentへ伝わったキーイベント
 * @param actions - 取り消し・やり直し・バックアップ保存の実行処理
 */
export function handleHistoryShortcut(event: KeyboardEvent, actions: HistoryShortcuts) {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.altKey) {
    return
  }

  const key = event.key.toLowerCase()

  if (event.ctrlKey && key === 's') {
    event.preventDefault()
    actions.saveBackup()
    return
  }

  if (!event.ctrlKey && !event.metaKey) {
    return
  }

  const target = event.target

  if (target instanceof Element && (
    target.closest('input, textarea, select') ||
    (target instanceof HTMLElement && target.isContentEditable) ||
    target.closest('[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]')
  )) {
    return
  }

  const undo = key === 'z' && !event.shiftKey
  const redo = (key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.shiftKey)

  if (!undo && !redo) {
    return
  }

  event.preventDefault()

  if (undo) {
    actions.undo()
  } else {
    actions.redo()
  }
}

/**
 * マウント中だけショートカットを受け付け、アンマウント時にリスナーを解除する。
 *
 * @param actions - キー操作と画面のボタンで共有する実行処理
 */
export function useHistoryShortcuts(actions: HistoryShortcuts) {
  const keydown = (event: KeyboardEvent) => handleHistoryShortcut(event, actions)

  onMounted(() => document.addEventListener('keydown', keydown))
  onBeforeUnmount(() => document.removeEventListener('keydown', keydown))
}
