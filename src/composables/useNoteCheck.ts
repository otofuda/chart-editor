import type { NoteData } from 'chart-types'
import type { ExtendedNoteData } from '../types'

type ComparatorsOption = {
  /** preAppendNotes 内を走査するかどうか */
  checkPreAppend?: boolean
  /** 比較対象となるノーツ配列 (未指定時は currentChart を使用) */
  comparators?: ExtendedNoteData[] | null
}

/**
 * ノートが重複しているか検査し、重複数を返す純粋関数
 * @param note - 検査するノート
 * @param currentChart - 現在の譜面のノート配列
 * @param preAppendNotes - 仮配置中のノート配列
 * @param option - 比較オプション
 */
export function isDuplicated(
  note: ExtendedNoteData,
  currentChart: ExtendedNoteData[],
  preAppendNotes: ExtendedNoteData[],
  option: ComparatorsOption = { checkPreAppend: true, comparators: null }
): number {
  const comparators = option.comparators ?? currentChart
  const posValue = note.position / note.split
  let cnt = 0

  comparators.forEach((target: ExtendedNoteData) => {
    // 同じ音符位置かつ同じレーンのノーツを検査
    if (
      target.measure === note.measure &&
      target.lane === note.lane &&
      target.position / target.split === posValue
    ) {
      // テクスチャの重複は許容
      if (target.type === 94 || note.type === 94) return

      // [通常|譜面停止|瞬間移動|LED制御|拍子変化|BPM変化]どうし
      // (ただし同じTypeでない)の重複は許容
      if (
        [1, 92, 93, 96, 97, 98].includes(target.type) &&
        [1, 92, 93, 96, 97, 98].includes(note.type) &&
        target.type !== note.type
      ) return

      // 左フリックと区切り線の重複は許容
      if (
        [3, 95].includes(target.type) &&
        [3, 95].includes(note.type) &&
        target.type !== note.type
      ) return

      // 右フリックと区切り線の重複は許容
      if (
        [4, 95].includes(target.type) &&
        [4, 95].includes(note.type) &&
        target.type !== note.type
      ) return

      // 通常と区切り線の重複は許容
      if (
        [1, 95].includes(target.type) &&
        [1, 95].includes(note.type) &&
        target.type !== note.type
      ) return

      // 音札ノーツとLN始点の重複は許容
      if (
        (target.type === 5 && note.type === 2) ||
        (target.type === 2 && note.type === 5)
      ) return

      // 対象自身は除外
      if (target.index === note.index) return

      cnt++
    }
  })

  if (option.checkPreAppend !== false && preAppendNotes) {
    preAppendNotes.forEach(target => {
      if (
        target.measure === note.measure &&
        target.lane === note.lane &&
        target.position / target.split === posValue
      ) {
        // [フリック|テクスチャ|区切り線]どうしの重複は許容
        if (
          [3, 4, 94, 95].includes(target.type) &&
          [3, 4, 94, 95].includes(note.type) &&
          target.type !== note.type
        ) return

        // 音札ノーツとLN始点の重複は許容
        if (
          (target.type === 5 && note.type === 2) ||
          (target.type === 2 && note.type === 5)
        ) return

        cnt++
      }
    })
  }

  return cnt
}

/**
 * ノートのバリデーションエラーを返す。問題なければ false を返す。
 * @param note - 検査するノート
 */
export function hasError(note: NoteData): string | false {
  if (note.split <= 0) return 'splitの値は0より大きい必要があります。'
  else if (note.position < 0) return 'positionの値は0以上である必要があります。'
  else if (note.position >= note.split) return 'positionの値はsplitの値未満である必要があります。'
  else if (
    [91, 92, 93, 96, 97, 98, 99, 100].includes(note.type) && note.lane !== -1
  ) return 'このノートタイプではレーン位置は-1である必要があります。'
  else if (
    note.type === 5 && note.lane !== 3
  ) return '音札ノートのレーン位置は3である必要があります。'
  else if (
    ![91, 92, 93, 96, 97, 98, 99, 100, 5].includes(note.type) &&
    (typeof note.lane !== 'number' || isNaN(note.lane) || note.lane < 0 || note.lane > 6)
  ) return '不正なノートのレーン位置です。'
  else if (
    ![1, 2, 3, 4, 5, 6, 7, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100].includes(note.type)
  ) return '不正なノートタイプです。'
  else return false
}

/**
 * ノートのオプション配列をバリデーションして正規化したものを返す
 * @param note - バリデーションするノート
 */
export function getValidatedOptions(note: NoteData): string[] {
  const type = Number(note.type)
  // optionはStringの配列
  const option = Array.from(note.option ?? [], value => value == null ? '' : String(value))
  // option: []
  if (type === 99) return []

  if (type === 90) {
    const targetType = Number(option[0] || '1')
    // 未対応の擬態先も保持するが、自分自身を擬態する不正値では再帰しない。
    if ([1, 2, 3, 4, 5].includes(targetType) && option.some(value => value !== '')) {
      return [
        option[0] || '1',
        ...getValidatedOptions({ ...note, type: targetType, option: option.slice(1) }),
      ]
    }
  }

  // 末尾のデフォルト曲線・幅の省略を維持する。先に省略してから途中の空欄を補う。
  if ([1, 89].includes(type)) {
    const width = Number(option[3])
    if (option.length > 3 && (!Number.isFinite(width) || width <= 0 || width === 1)) option[3] = ''
    if (option[2] === 'linear' && !option.slice(3).some(value => value !== '')) option[2] = ''
  }
  if (type === 95 && Number(note.position) === 0) option[0] = '-1'

  // 不明なtypeでも入力済みの値と添字を保持し、Stringの配列として返す。
  const { defaults = [], required = 0 } = optionDefaults[type] ?? {}
  while (option.length > required && option.at(-1) === '') option.pop()
  return Array.from({ length: Math.max(required, option.length) }, (_, index) =>
    option[index] === undefined || option[index] === ''
      ? defaults[index] ?? ''
      : option[index]
  )
}

/** 必須の先頭項目は従来どおり出力し、それ以降は後続入力があるときだけ補完する。 */
const optionDefaults: Record<number, { defaults: string[]; required?: number }> = {
  // 通常ノート／終点・中点の場合（type: 89も同じ並び）
  // option: [(speed (, orbit (, curve (, width))))]
  1: { defaults: ['1', '0', 'linear', '1'] },
  // ロングノート始点の場合
  // option: [(speed (, orbit))]
  2: { defaults: ['1', '0'] },
  // フリックの場合（type: 3, 4, 6, 7）
  // option: [width (, offsetNumer, offsetDenom (, speed (, orbit)))]
  3: { defaults: ['-1', '0', '1', '1', '0'], required: 1 },
  4: { defaults: ['-1', '0', '1', '1', '0'], required: 1 },
  // 音札の場合
  // option: [(speed)]
  5: { defaults: ['1'] },
  6: { defaults: ['-1', '0', '1', '1', '0'], required: 1 },
  7: { defaults: ['-1', '0', '1', '1', '0'], required: 1 },
  89: { defaults: ['1', '0', 'linear', '1'] },
  90: { defaults: ['1'] },
  91: { defaults: ['', '', ''] },
  93: { defaults: ['4'] },
  // テクスチャの場合
  // option: [source, width, height (, offsetNumer, offsetDenom (, speed (, orbit)))]
  // type94 テクスチャのデフォルト幅は 1、高さは 0.25、offsetNumer / offsetDenom は 0 / 1
  94: { defaults: ['texture/202020.png', '1', '0.25', '0', '1', '1', '0'], required: 3 },
  // 区切り線の場合
  // option: [length (, speed (, orbit))]
  95: { defaults: ['1', '1', '0'], required: 1 },
  // LED制御の場合
  // option: [r, g, b]
  96: { defaults: ['0', '0', '0'], required: 3 },
  // 拍子変化、BPM変化の場合
  97: { defaults: ['-1'], required: 1 },
  98: { defaults: ['-1'], required: 1 },
  // コメントの場合
  100: { defaults: [''], required: 1 },
}

/**
 * ノートをバリデーション・正規化して返す純粋関数
 * @param note - バリデーションするノート
 */
export function getValidatedNote(note: NoteData): NoteData {
  return normalizeNote(note, false)
}

function normalizeNote(note: NoteData, isEndpoint: boolean): NoteData {
  const type = Number(note.type)
  const option = getValidatedOptions(note)

  // type: 5 は lane: 3
  // type: 91, 92, 93, 96, 97, 98, 99, 100 は lane: -1
  let lane = Number(note.lane) as NoteData['lane']
  if (type === 5) lane = 3
  if ([91, 92, 93, 96, 97, 98, 99, 100].includes(type)) lane = -1

  // ロング、ロングダミー、またはロング内の終点ネストは再帰的にバリデーション
  const isLongRoot = !isEndpoint && (type === 2 || (type === 90 && option[0] === '2'))
  const canHaveEnd = isLongRoot || (isEndpoint && [1, 89].includes(type))
  const end = canHaveEnd && Array.isArray(note.end)
    ? note.end.map(child => normalizeNote(child, true))
    : []

  return {
    type,
    measure: Number(note.measure),
    lane,
    position: Number(note.position),
    split: Number(note.split),
    option,
    end,
  }
}

/**
 * lane: -1 固定ノートであるか
 * @param note - 検査するノート
 */
export function isLanelessNote(note: NoteData): boolean {
  return [91, 92, 93, 96, 97, 98, 99, 100].includes(note.type)
}
