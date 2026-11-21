import { inject, type ObjectDirective } from 'vue'
import { chartHistoryKey } from './injectionKeys'
import type { ChartHistory, HistoryMeta } from './useChartHistory'

/** 入力欄から履歴の開始・確定へ渡す情報。仮配置の入力欄では使用しない。 */
interface HistoryField {
  history: ChartHistory
  meta: HistoryMeta
  owner?: object
  finish?: () => void
  isDirty?: () => boolean
}

type FieldElement = HTMLElement & {
  historyField?: {
    binding?: HistoryField
    token?: number
    dispose: () => void
  }
}

/**
 * v-modelが譜面を書き換える前に編集を開始し、blurまたはEnterで確定する。
 * キーイベントの標準動作は止めず、入力欄のUndo / Redoを維持する。
 */
export const vHistoryField: ObjectDirective<FieldElement, HistoryField | undefined> = {
  mounted(element, binding) {
    const state: NonNullable<FieldElement['historyField']> = {
      binding: binding.value,
      dispose: () => {},
    }
    element.historyField = state

    /** 同じ入力欄で発生したフォーカス・入力イベントを一つの編集へまとめる。 */
    const begin = () => {
      const field = state.binding

      if (field) {
        state.token = field.history.beginEdit(field.meta, {
          owner: field.owner ?? element,
          finish: field.finish,
          isDirty: field.isDirty,
        })
      }
    }

    /** この入力欄が開始した編集だけを確定する。 */
    const finish = () => {
      if (state.token !== undefined) {
        state.binding?.history.commitEdit(state.token)
      }

      state.token = undefined
    }

    /** 入力コンポーネント内のフォーカス移動では確定せず、外へ移ったときに確定する。 */
    const blur = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node) || !element.contains(event.relatedTarget)) {
        finish()
      }
    }

    /** IME変換を妨げず、Enterでの確定と矢印キーによる位置変更を履歴へ反映する。 */
    const enter = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) {
        return
      }

      if (event.key === 'Enter') {
        finish()
      } else if (event.key.startsWith('Arrow')) {
        // 独自の矢印操作ではinputイベントなしでレーンや位置が変わる場合がある。
        begin()
      }
    }

    element.addEventListener('focusin', begin)
    element.addEventListener('beforeinput', begin, true)
    element.addEventListener('input', begin, true)
    element.addEventListener('focusout', blur)
    element.addEventListener('keydown', enter, true)

    state.dispose = () => {
      element.removeEventListener('focusin', begin)
      element.removeEventListener('beforeinput', begin, true)
      element.removeEventListener('input', begin, true)
      element.removeEventListener('focusout', blur)
      element.removeEventListener('keydown', enter, true)
      finish()
    }
  },
  updated(element, binding) {
    if (element.historyField) {
      element.historyField.binding = binding.value
    }
  },
  beforeUnmount(element) {
    element.historyField?.dispose()
    delete element.historyField
  },
}

/**
 * 確定済みノーツの入力・選択操作を共通の履歴へ接続する。
 *
 * @param enabled - 履歴を記録するかを返す関数。仮配置の終点フォームではfalseにする
 * @returns 入力欄用の設定と、選択式・comboboxの変更を記録する関数
 */
export function useHistoryFields(enabled: () => boolean = () => true) {
  const history = inject(chartHistoryKey, null)
  const owners = new Map<string, object>()

  /** 描画をまたいでも変わらない、入力欄ごとの識別オブジェクトを取得する。 */
  function owner(label: string) {
    if (!owners.has(label)) {
      owners.set(label, {})
    }

    return owners.get(label)!
  }

  /**
   * 入力欄へ渡すディレクティブの設定を生成する。
   *
   * @param label - 履歴一覧に表示する操作名
   * @param finish - 小節番号など、一時的な入力値を譜面へ適用する処理
   * @param isDirty - 譜面へ未反映の変更があるかを返す処理
   */
  function field(
    label: string,
    finish?: () => void,
    isDirty?: () => boolean
  ): HistoryField | undefined {
    return history && enabled()
      ? { history, meta: { label }, owner: owner(label), finish, isDirty }
      : undefined
  }

  /** 選択式の変更や終点の追加・削除を、確定済みの1操作として記録する。 */
  function change<T>(label: string, mutation: () => T): T {
    return history && enabled() ? history.run({ label }, mutation) : mutation()
  }

  /** comboboxの入力・候補選択を、同じ入力欄の編集へまとめて反映する。 */
  function input(label: string, mutation: () => void) {
    // 別のDOM位置に描画した候補一覧からの選択では、通常のinputイベントが発生しない。
    if (history && enabled()) {
      history.updateEdit({ label }, mutation, owner(label))
    } else {
      mutation()
    }
  }

  return { history, field, change, input }
}

/**
 * v-model.numberと同じ規則で入力値を数値へ変換する。
 * 空欄などの未完成な入力は、0やNaNへ変換せず元の値を維持する。
 *
 * @param value - 入力欄または候補一覧から受け取った値
 * @returns 変換できた数値、または入力途中の元の値
 */
export function numberInputValue(value: unknown): number {
  const parsed = Number.parseFloat(String(value))

  return (Number.isNaN(parsed) ? value : parsed) as number
}
