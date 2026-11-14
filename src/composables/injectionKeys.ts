import type { InjectionKey } from 'vue'
import type { NoteData } from 'chart-types'
import type { DifficultyString } from '../types'
import type { ChartHistory } from './useChartHistory'

/** 確定済みの譜面編集に対して、画面全体で共有する操作履歴。 */
export const chartHistoryKey: InjectionKey<ChartHistory> = Symbol('chartHistory')

/** スナックバーメッセージを表示する */
export const showSnackbarKey: InjectionKey<(message: string) => void> =
  Symbol('showSnackbar')

/** インデックスを指定してノートを削除する */
export const deleteNotesKey: InjectionKey<(...indices: number[]) => void> =
  Symbol('deleteNotes')

/** 仮配置をキャンセルする */
export const cancelNoteKey: InjectionKey<(index: number) => void> =
  Symbol('cancelNote')

/** ノートを譜面に追加する */
export const appendNotesKey: InjectionKey<(...notes: NoteData[]) => void> =
  Symbol('appendNotes')

/** ノートを別の小節に移動した場合の新しいノートオブジェクトを返す */
export const getMovedNoteKey: InjectionKey<
  (oldNote: NoteData, newMeasure: number) => NoteData
> = Symbol('getMovedNote')

/** ノートを指定難易度にコピーする */
export const copyNotesToDifficultyKey: InjectionKey<
  (targetDifficulty: DifficultyString | null, ...targets: NoteData[]) => void
> = Symbol('copyNotesToDifficulty')

/** 挿入ノート情報をセットする */
export const setAppendNoteInfoKey: InjectionKey<(object: NoteData) => void> =
  Symbol('setAppendNoteInfo')
