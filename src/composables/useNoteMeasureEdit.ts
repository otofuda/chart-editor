import { ref, watch } from 'vue'
import type { ExtendedNoteData } from '../types'

/**
 * ノーツの編集メニューで使う小節番号を一時的に保持する
 * メニューを閉じるときは、開いた時点と同じノーツにだけ入力値を確定する
 */
export function useNoteMeasureEdit(getNote: () => ExtendedNoteData) {
  const menu = ref(false)
  const localMeasure = ref(getNote().measure)
  let editingNote: ExtendedNoteData | undefined

  // 同期的に対象を記録・確定し、描画更新後に別のノーツへ書き込まないようにする
  watch(menu, isOpen => {
    if (isOpen) {
      editingNote = getNote()
      localMeasure.value = editingNote.measure
    } else {
      if (editingNote === getNote()) editingNote.measure = localMeasure.value
      editingNote = undefined
    }
  }, { flush: 'sync' })

  // 譜面や難易度の切り替えで対象が置き換わったら、未確定の入力を破棄する
  // 先に対象を解除してからメニューを閉じ、閉じる処理による書き込みも防ぐ
  watch(getNote, () => {
    editingNote = undefined
    menu.value = false
  }, { flush: 'sync' })

  return { menu, localMeasure }
}
