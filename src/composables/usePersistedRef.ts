import { ref, watch, type Ref } from 'vue'

type NumberRange = {
  min?: number
  max?: number
}

/**
 * 真偽値または数値の設定を復元し、有効な変更を localStorage に保存する。
 * ストレージを利用できない場合も、返した ref は通常どおり使用できる。
 */
export function usePersistedRef(key: string, initialValue: boolean): Ref<boolean>
export function usePersistedRef(
  key: string,
  initialValue: number,
  range?: NumberRange,
): Ref<number>
export function usePersistedRef(
  key: string,
  initialValue: boolean | number,
  range: NumberRange = {},
): Ref<boolean> | Ref<number> {
  function isValid(value: unknown): value is boolean | number {
    if (typeof initialValue === 'boolean') return typeof value === 'boolean'
    return (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      (range.min === undefined || value >= range.min) &&
      (range.max === undefined || value <= range.max)
    )
  }

  let restored = initialValue
  try {
    const stored = localStorage.getItem(key)
    if (stored !== null) {
      const parsed: unknown = JSON.parse(stored)
      if (isValid(parsed)) restored = parsed
    }
  } catch {
    // 保存値が不正な場合やストレージを利用できない場合は初期値を使う。
  }

  const value = ref<boolean | number>(restored)
  watch(
    value,
    next => {
      // 数値欄の編集中に生じる空文字などは、前回の保存値を上書きしない。
      if (!isValid(next)) return
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // 保存できなくても、現在のセッションでは変更を反映する。
      }
    },
    { flush: 'sync' },
  )

  return value as Ref<boolean> | Ref<number>
}

/** 既存の数値設定を、従来と同じ形式と初期値の扱いで読み込む。 */
export function readLegacyNumber(key: string, fallback: number): number {
  try {
    return Number(localStorage.getItem(key)) || fallback
  } catch {
    return fallback
  }
}

/** 既存の数値設定を、従来と同じ文字列形式で保存する。 */
export function writeLegacyNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // 保存できなくても、現在のセッションでは変更を反映する。
  }
}
