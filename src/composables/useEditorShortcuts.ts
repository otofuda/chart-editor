import { onBeforeUnmount, onMounted } from 'vue'

/** キー操作と画面のボタンで共有する、エディタ操作の識別子。 */
export type EditorShortcutId =
  | 'togglePlayback'
  | 'toggleAppendMode'
  | 'placeNotes'
  | 'appendNotes'
  | 'selectAll'
  | 'deleteSelection'
  | 'escape'
  | 'help'
  | 'saveBackup'
  | 'undo'
  | 'redo'

/** キー名と、同時に押す必要がある修飾キーの組み合わせ。 */
type ShortcutBinding = {
  /** KeyboardEvent.keyを小文字にした値。スペースは半角空白で表す。 */
  key: string
  /** modはCtrlまたはCmdの片方。省略時はどちらも押されていないことを要求する。 */
  modifier?: 'mod' | 'ctrl'
  /** optionalはキーボード配列によってShiftが必要になる「?」用。省略時はShiftなし。 */
  shift?: boolean | 'optional'
}

/** 割り当てと、入力・長押し・ドラッグ中に実行できる条件。 */
type ShortcutDefinition = {
  label: string
  bindings: readonly ShortcutBinding[]
  /** 入力中の例外。省略時は入力欄からの操作を受け付けない。 */
  input?: 'placement' | 'always'
  /** trueの操作だけ、キーの長押しによる連続実行を許可する。 */
  repeat?: boolean
  /** ドラッグ中にも利用する、既存の履歴操作やバックアップ保存用。 */
  duringDrag?: boolean
}

/** キー判定と画面上の補足表示で共有する固定の割り当て。 */
export const editorShortcuts: Readonly<Record<EditorShortcutId, ShortcutDefinition>> = {
  togglePlayback: {
    label: '再生／停止',
    bindings: [{ key: ' ' }],
  },
  toggleAppendMode: {
    label: '挿入モード切替',
    bindings: [{ key: 'i' }],
  },
  placeNotes: {
    label: '仮配置',
    bindings: [{ key: 'enter' }],
  },
  appendNotes: {
    label: '確定挿入',
    bindings: [{ key: 'enter', modifier: 'mod' }],
    input: 'placement',
  },
  selectAll: {
    label: 'すべて選択',
    bindings: [{ key: 'a', modifier: 'mod' }],
  },
  deleteSelection: {
    label: '選択ノーツの削除確認',
    bindings: [{ key: 'delete' }],
  },
  escape: {
    label: '操作の中断・選択解除',
    bindings: [{ key: 'escape' }],
  },
  help: {
    label: '使い方',
    bindings: [{ key: '?', shift: 'optional' }],
  },
  saveBackup: {
    label: 'バックアップ保存',
    bindings: [{ key: 's', modifier: 'mod' }],
    input: 'always',
    duringDrag: true,
  },
  undo: {
    label: '元に戻す',
    bindings: [{ key: 'z', modifier: 'mod' }],
    repeat: true,
    duringDrag: true,
  },
  redo: {
    label: 'やり直す',
    bindings: [
      { key: 'z', modifier: 'mod', shift: true },
      { key: 'y', modifier: 'ctrl' },
    ],
    repeat: true,
    duringDrag: true,
  },
}

/** キーイベントの値を、ボタンの補足で読むための表記へ変換する対応表。 */
const KEY_LABELS: Readonly<Record<string, string>> = {
  ' ': 'Space',
  enter: 'Enter',
  escape: 'Esc',
  delete: 'Delete',
}

/**
 * 操作に割り当てられたキーを、人間が読める表記にする。
 *
 * @param id キー表記を取得する操作の識別子
 * @returns 複数の割り当てがある場合は「 / 」で区切ったキー表記
 */
export function shortcutKeys(id: EditorShortcutId): string {
  return editorShortcuts[id].bindings.map(binding => {
    const key = KEY_LABELS[binding.key] ?? binding.key.toUpperCase()
    let modifier = ''

    if (binding.modifier === 'mod') {
      modifier = 'Ctrl/Cmd'
    } else if (binding.modifier === 'ctrl') {
      modifier = 'Ctrl'
    }

    return [
      modifier,
      binding.shift === true ? 'Shift' : '',
      key,
    ].filter(Boolean).join('+')
  }).join(' / ')
}

/**
 * 操作名とキー表記をまとめ、関連ボタンの補足文を生成する。
 *
 * @param id 補足文を表示する操作の識別子
 * @returns 操作名にキー表記を添えた文字列
 */
export function shortcutTitle(id: EditorShortcutId): string {
  return `${editorShortcuts[id].label} (${shortcutKeys(id)})`
}

/**
 * ローカル操作とグローバル操作で共通の、処理すべきでないイベントを判定する。
 *
 * @param event 受け取ったキーイベント
 * @returns IME変換中、または別の処理が既定動作を抑止している場合はtrue
 */
export function isIgnoredKeyboardEvent(event: KeyboardEvent): boolean {
  return event.defaultPrevented || event.isComposing || event.keyCode === 229
}

/**
 * 譜面操作より優先するメニューやダイアログが表示中かを調べる。
 *
 * @returns Teleport先も含めて、操作を受け付けるメニュー等があればtrue
 */
export function hasOpenEditorOverlay(): boolean {
  // ツールチップは入力を受け付けないため、操作を遮断する対象に含めない。
  return document.querySelector('.v-menu.v-overlay--active, .v-dialog.v-overlay--active') !== null
}

/**
 * 文字編集や入力コンポーネントの標準操作を優先する対象かを判定する。
 *
 * @param target キーイベントが発生した要素
 * @returns 入力欄、または編集可能な要素の内側にある場合はtrue
 */
function isInputTarget(target: Element): boolean {
  if (target.closest([
    'input',
    'textarea',
    'select',
    '[role="textbox"]',
    '[role="combobox"]',
    '[role="spinbutton"]',
  ].join(', '))) {
    return true
  }

  // 最も近い指定を使い、contenteditable="false"による編集範囲の解除も考慮する。
  const editable = target.closest('[contenteditable]')

  return (target instanceof HTMLElement && target.isContentEditable)
    || (editable !== null && editable.getAttribute('contenteditable') !== 'false')
}

/**
 * 単独キーより、ボタンなどの通常のキーボード操作を優先する対象かを調べる。
 *
 * @param target キーイベントが発生した要素
 * @returns ボタン、リンク、選択UIなどの内側にある場合はtrue
 */
function isInteractiveTarget(target: Element): boolean {
  return target.closest([
    'button',
    'a[href]',
    'summary',
    '[role="button"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[role="slider"]',
    '[role="tab"]',
    '[role="option"]',
    '[role="listbox"]',
    '[role="tree"]',
    '[role="grid"]',
    '[role^="menuitem"]',
  ].join(', ')) !== null
}

/**
 * キー名と修飾キーが割り当てに一致するかを判定する。
 *
 * @param event 受け取ったキーイベント
 * @param binding 照合するキー割り当て
 * @returns 必要な修飾キーだけが押され、キー名も一致する場合はtrue
 */
function matches(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  let modifierMatches: boolean

  switch (binding.modifier) {
    case 'mod':
      modifierMatches = event.ctrlKey !== event.metaKey
      break
    case 'ctrl':
      modifierMatches = event.ctrlKey && !event.metaKey
      break
    default:
      modifierMatches = !event.ctrlKey && !event.metaKey
  }

  return modifierMatches
    && event.key.toLowerCase() === binding.key
    && (binding.shift === 'optional' || event.shiftKey === Boolean(binding.shift))
}

/** 画面とキー操作で共有する実行処理。未登録の操作はキーを消費しない。 */
export type EditorShortcutActions = Partial<Record<EditorShortcutId, () => void>>

/** 現在の編集状態に応じて、ショートカットの実行可否を判断する窓口。 */
export type EditorShortcutContext = {
  /** 未指定時は操作を許可する。挿入モードや選択数などの条件を呼び出し元で判定する。 */
  enabled?: (id: EditorShortcutId) => boolean
  /** 移動し始める前のポインター押下中も含めて、ドラッグ操作中かを返す。 */
  isDragging?: () => boolean
}

/**
 * 標準の入力操作とローカル操作を優先し、受け付けたキーだけを消費する。
 *
 * @param event documentへ伝わったキーイベント
 * @param actions キーから呼び出す画面と共通の操作
 * @param context 現在の編集状態と利用条件
 * @returns キーを消費した場合はtrue。長押しを抑止した場合も含む
 */
export function handleEditorShortcut(
  event: KeyboardEvent,
  actions: EditorShortcutActions,
  context: EditorShortcutContext = {},
): boolean {
  if (isIgnoredKeyboardEvent(event) || event.altKey) {
    return false
  }

  const entry = (Object.entries(editorShortcuts) as [EditorShortcutId, ShortcutDefinition][])
    .find(([, definition]) => definition.bindings.some(binding => matches(event, binding)))

  if (!entry) {
    return false
  }

  const [id, definition] = entry
  const action = actions[id]

  // VuetifyはwindowでEscを処理する。長押しが次のメニュー等も閉じないよう先に止める。
  if (id === 'escape' && action && event.repeat && hasOpenEditorOverlay()) {
    event.preventDefault()
    event.stopPropagation()

    return true
  }

  // 個別操作の利用条件を確かめてから、メニューやドラッグに操作を譲る。
  if (!action || context.enabled?.(id) === false) {
    return false
  }

  if (id !== 'saveBackup' && hasOpenEditorOverlay()) {
    return false
  }

  if (!definition.duringDrag && context.isDragging?.()) {
    return false
  }

  const target = event.target

  if (target instanceof Element) {
    if (
      isInputTarget(target)
      && definition.input !== 'always'
      && !(definition.input === 'placement' && target.closest('[data-editor-placement]'))
    ) {
      return false
    }

    // Escはボタンを作動させないため、メニューがボタンへフォーカスを戻した後も使える。
    if (!event.ctrlKey && !event.metaKey && id !== 'escape' && isInteractiveTarget(target)) {
      return false
    }
  }

  event.preventDefault()

  if (!event.repeat || definition.repeat) {
    action()
  }

  return true
}

/**
 * position欄の通常Enterで仮配置し、Mod+Enterは共通の確定挿入へ渡す。
 *
 * @param event position欄で発生したキーイベント
 * @param place 仮配置、または既存ノーツの編集確定を行う処理
 */
export function handlePositionEnter(event: KeyboardEvent, place: () => void): void {
  if (
    isIgnoredKeyboardEvent(event)
    || event.key !== 'Enter'
    || event.ctrlKey
    || event.metaKey
    || event.shiftKey
    || event.altKey
  ) {
    return
  }

  event.preventDefault()

  if (!event.repeat) {
    place()
  }
}

/**
 * マウント中だけ、アプリ全体に一つのショートカットリスナーを登録する。
 *
 * @param actions ボタンとキー操作で共有する実行処理
 * @param context 現在の編集状態と利用条件
 */
export function useEditorShortcuts(
  actions: EditorShortcutActions,
  context: EditorShortcutContext = {},
) {
  /** 同じ関数参照で登録・解除し、再マウント時のリスナー重複を防ぐ。 */
  const keydown = (event: KeyboardEvent) => handleEditorShortcut(event, actions, context)

  onMounted(() => document.addEventListener('keydown', keydown))
  onBeforeUnmount(() => document.removeEventListener('keydown', keydown))
}
