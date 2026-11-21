import { computed, readonly, shallowRef, type Ref } from 'vue'
import type { DifficultyString, ExtendedChartData } from '../types'

/** 操作名と、編集対象・復元後の表示先の難易度を表す。 */
export interface HistoryMeta {
  label: string
  /** 譜面情報の変更では空配列、複数難易度への操作では対象をすべて指定する。 */
  difficulties?: DifficultyString[]
  displayDifficulty?: DifficultyString
}

/** 履歴一覧に公開する情報。譜面のスナップショットは含めない。 */
export interface HistoryEntry {
  id: number
  label: string
  difficulties: DifficultyString[]
  displayDifficulty: DifficultyString
  date: Date
}

/** 同じ入力欄での編集をまとめ、未確定の値を履歴へ反映するための設定。 */
interface EditOptions {
  /** 入力欄を識別し、フォーカスと入力イベントで同じ編集を共有する。 */
  owner?: object
  /** 小節番号など、一時的に保持している入力値を譜面へ適用する。 */
  finish?: () => void
  /** 譜面へ未反映の入力も、取り消し可否の判定に含める。 */
  isDirty?: () => boolean
}

/** 操作の前後の譜面を保持する内部データ。 */
interface StoredEntry {
  entry: HistoryEntry
  before: ExtendedChartData
  after: ExtendedChartData
}

/** 入力欄の確定を待っている編集と、その開始時点の譜面。 */
interface PendingEdit {
  token: number
  meta: HistoryMeta
  before: ExtendedChartData
  options: EditOptions
}

/**
 * 選択状態を除いて値を再帰的に複製する。
 * 入力途中の数値は正規化せず、ネストしたVueのProxyも通常のオブジェクトへ変換する。
 *
 * @param value - 複製する譜面データまたはその一部
 * @returns 元のデータと参照を共有しない値
 */
function copy<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(copy) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'isSelected')
        .map(([key, item]) => [key, copy(item)])
    ) as T
  }

  return value
}

/** 選択状態を無視して値を比較し、NaNなどJSON化で失われる差も判定する。 */
function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true
  }

  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    return false
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return false
  }

  const keys = Object.keys(a).filter(key => key !== 'isSelected')
  const other = Object.keys(b).filter(key => key !== 'isSelected')

  return keys.length === other.length && keys.every(key => (
    Object.hasOwn(b, key) && equal(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key]
    )
  ))
}

/**
 * 全難易度で共通の操作履歴を時系列で管理する。
 * スナップショットは内部に保持し、画面には操作情報と現在位置だけを公開する。
 *
 * @param chart - 編集中の譜面全体
 * @param difficulty - 表示中の難易度。復元時には操作の対象へ切り替える
 * @param limit - メモリ内に保持する操作件数の上限
 * @returns 編集の記録・確定・取り消し・やり直しと、表示用の履歴情報
 */
export function useChartHistory(
  chart: Ref<ExtendedChartData>,
  difficulty: Ref<DifficultyString>,
  limit = 100,
) {
  const stored = shallowRef<StoredEntry[]>([])
  const cursor = shallowRef(0)
  const revision = shallowRef(0)
  const pending = shallowRef<PendingEdit | null>(null)
  const beforeRestore = new Set<() => void>()

  let nextId = 0
  let nextToken = 0
  let depth = 0

  /** 操作開始時の難易度を基準に、対象と復元後の表示先を確定する。 */
  function metadata(meta: HistoryMeta): HistoryMeta {
    const targets = [...(meta.difficulties ?? [difficulty.value])]

    return {
      ...meta,
      difficulties: targets,
      displayDifficulty: meta.displayDifficulty ?? (
        targets.length === 1 ? targets[0] : difficulty.value
      ),
    }
  }

  /** 変化がある操作だけを記録し、Redo側の分岐と上限を超えた履歴を破棄する。 */
  function record(meta: HistoryMeta, before: ExtendedChartData) {
    if (equal(before, chart.value)) {
      return
    }

    const previous = stored.value[cursor.value - 1]
    const entry: HistoryEntry = {
      id: ++nextId,
      label: meta.label,
      difficulties: meta.difficulties!,
      displayDifficulty: meta.displayDifficulty!,
      date: new Date(),
    }

    // 連続する操作で境界の状態が一致する場合は、同じスナップショットを共有する。
    const next = [
      ...stored.value.slice(0, cursor.value),
      {
        entry,
        before: previous && equal(previous.after, before) ? previous.after : before,
        after: copy(chart.value),
      },
    ]

    stored.value = next.slice(-limit)
    cursor.value = stored.value.length
  }

  /**
   * 入力中の編集を確定し、開始時点からの変化を1件の履歴として記録する。
   *
   * @param token - 対象の編集番号。古い入力欄から遅れて届いた確定処理を除外する
   */
  function commitEdit(token?: number) {
    const edit = pending.value

    if (!edit || (token !== undefined && token !== edit.token)) {
      return
    }

    pending.value = null
    depth++

    try {
      edit.options.finish?.()
    } finally {
      depth--
    }

    record(edit.meta, edit.before)
  }

  /**
   * 入力欄の編集を開始する。同じ欄からの連続イベントは同じ編集として扱う。
   *
   * @param meta - 操作名と対象難易度
   * @param options - 入力欄の識別情報と、未確定の値を反映する処理
   * @returns 確定時に入力欄を照合するための編集番号
   */
  function beginEdit(meta: HistoryMeta, options: EditOptions = {}) {
    if (pending.value && options.owner && pending.value.options.owner === options.owner) {
      return pending.value.token
    }

    commitEdit()

    const token = ++nextToken
    pending.value = {
      token,
      meta: metadata(meta),
      before: copy(chart.value),
      options,
    }

    return token
  }

  /** 同じ難易度・indexのノーツの選択状態を維持しながら、譜面を復元する。 */
  function applySnapshot(snapshot: ExtendedChartData) {
    const next = copy(snapshot)

    for (const key of ['raku', 'easy', 'normal', 'hard', 'extra'] as const) {
      const selected = new Map(
        chart.value[key]
          .filter(note => note.index != null)
          .map(note => [note.index, Boolean(note.isSelected)])
      )

      next[key].forEach(note => {
        note.isSelected = selected.get(note.index) ?? false
      })
    }

    chart.value = next
  }

  /**
   * 同期的な譜面変更を1操作として実行する。
   * 内側の操作はまとめて記録し、例外が起きた場合は実行前の譜面へ戻す。
   *
   * @param meta - 記録する操作名と対象難易度
   * @param mutation - 譜面を変更する同期処理
   * @returns 譜面変更処理の戻り値
   */
  function run<T>(meta: HistoryMeta, mutation: () => T): T {
    if (depth) {
      return mutation()
    }

    commitEdit()

    const resolved = metadata(meta)
    const before = copy(chart.value)
    depth++

    try {
      const result = mutation()
      record(resolved, before)

      return result
    } catch (error) {
      applySnapshot(before)
      throw error
    } finally {
      depth--
    }
  }

  /** 譜面を置き換える前に、古い編集メニューを閉じて再生・ドラッグを中断する。 */
  function prepareRestore() {
    revision.value++
    beforeRestore.forEach(callback => callback())
  }

  /**
   * 未確定の入力と履歴を破棄し、必要に応じて新しい譜面へ切り替える。
   *
   * @param next - 読み込みに成功した譜面。省略時は現在の譜面を維持する
   */
  function reset(next?: ExtendedChartData) {
    pending.value = null
    prepareRestore()

    if (next) {
      chart.value = next
    }

    stored.value = []
    cursor.value = 0
  }

  /** 入力中の編集を確定してから、直前の操作を取り消す。 */
  function undo() {
    commitEdit()

    const item = stored.value[cursor.value - 1]

    if (!item) {
      return
    }

    prepareRestore()
    applySnapshot(item.before)
    difficulty.value = item.entry.displayDifficulty
    cursor.value--

    return item.entry
  }

  /** 入力中の編集を確定してから、取り消した操作をやり直す。 */
  function redo() {
    commitEdit()

    const item = stored.value[cursor.value]

    if (!item) {
      return
    }

    prepareRestore()
    applySnapshot(item.after)
    difficulty.value = item.entry.displayDifficulty
    cursor.value++

    return item.entry
  }

  const hasPendingChange = computed(() => Boolean(
    pending.value && (
      pending.value.options.isDirty?.() || !equal(pending.value.before, chart.value)
    )
  ))

  return {
    run,
    beginEdit,
    commitEdit,
    reset,
    undo,
    redo,
    prepareRestore,
    /** 同じ入力欄の更新は編集中の履歴へ含め、それ以外は新しい操作として実行する。 */
    updateEdit<T>(meta: HistoryMeta, mutation: () => T, owner: object): T {
      return pending.value?.options.owner === owner ? mutation() : run(meta, mutation)
    },
    canUndo: computed(() => cursor.value > 0 || hasPendingChange.value),
    canRedo: computed(() => cursor.value < stored.value.length && !hasPendingChange.value),
    entries: computed(() => stored.value.map(item => item.entry)),
    cursor: readonly(cursor),
    revision: readonly(revision),
    /** 譜面の復元直前に呼ぶ処理を登録し、登録解除用の関数を返す。 */
    onBeforeRestore(callback: () => void) {
      beforeRestore.add(callback)

      return () => {
        beforeRestore.delete(callback)
      }
    },
  }
}

/** 編集画面や入力欄で共有する操作履歴のインターフェース。 */
export type ChartHistory = ReturnType<typeof useChartHistory>
