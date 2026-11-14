import { ref, watch } from 'vue'
import type { ExtendedNoteData } from '../types'
import type { ChartHistory } from './useChartHistory'

/**
 * ノーツの編集メニューで使う小節番号を一時的に保持する。
 * メニューを閉じるときは、開いた時点と同じノーツにだけ入力値を確定する。
 *
 * @param getNote - 現在の編集対象のノーツを返す関数
 * @param history - 小節変更を記録する履歴。省略時は値の確定のみを行う
 * @returns メニューの状態、小節番号の入力値、確定・変更判定の処理
 */
export function useNoteMeasureEdit(
  getNote: () => ExtendedNoteData,
  history: ChartHistory | null = null
) {
  const menu = ref(false)
  const localMeasure = ref(getNote().measure)
  let editingNote: ExtendedNoteData | undefined

  /** メニューを開いたときと同じノーツにだけ、小節番号を適用する。 */
  function applyMeasure() {
    if (editingNote === getNote()) {
      editingNote.measure = localMeasure.value
    }
  }

  /** 小節番号の変更を、入力欄の編集または独立した履歴として確定する。 */
  function commitMeasure() {
    if (history) {
      history.run({ label: '小節番号を変更' }, applyMeasure)
    } else {
      applyMeasure()
    }
  }

  /** 対象の変更や履歴の復元時に、古い入力を適用せずメニューを閉じる。 */
  function discard() {
    editingNote = undefined
    menu.value = false
  }

  /** 現在のノーツへ未反映の小節番号があるかを返す。 */
  function isMeasureDirty() {
    return editingNote === getNote() && localMeasure.value !== getNote().measure
  }

  if (history) {
    watch(history.revision, discard, { flush: 'sync' })
  }

  // 同期的に対象を記録・確定し、描画更新後に別のノーツへ書き込まないようにする
  watch(menu, isOpen => {
    if (isOpen) {
      editingNote = getNote()
      localMeasure.value = editingNote.measure
    } else {
      commitMeasure()
      editingNote = undefined
    }
  }, { flush: 'sync' })

  // 譜面や難易度の切り替えで対象が置き換わったら、未確定の入力を破棄する
  // 先に対象を解除してからメニューを閉じ、閉じる処理による書き込みも防ぐ
  watch(getNote, () => {
    discard()
  }, { flush: 'sync' })

  return {
    menu,
    localMeasure,
    applyMeasure,
    commitMeasure,
    isMeasureDirty,
  }
}
