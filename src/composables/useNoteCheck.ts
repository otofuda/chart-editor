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
    note.lane !== -1 &&
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
  const option: string[] = [] // optionはStringの配列

  // option: []
  if ([99].includes(note.type)) return option

  // ロングノート始点の場合
  // option: [(speed (, orbit))]
  else if (note.type === 2) {
    if (note.option && note.option[0] !== undefined && note.option[0] !== '') {
      option.push(String(note.option[0]))
      if (note.option[1] !== undefined && note.option[1] !== '') option.push(String(note.option[1]))
    }
    return option
  }

  // 通常ノート／終点・中継点の場合
  // option: [(speed (, orbit (, curve)))]
  else if ([1, 89].includes(note.type)) {
    const speed = note.option?.[0] !== undefined && note.option[0] !== null ? String(note.option[0]) : ''
    const orbit = note.option?.[1] !== undefined && note.option[1] !== null ? String(note.option[1]) : ''
    const curve = note.option?.[2] !== undefined && note.option[2] !== null ? String(note.option[2]) : ''

    if (curve && curve !== 'linear') {
      option.push(speed, orbit, curve)
    } else if (orbit) {
      option.push(speed, orbit)
    } else if (speed) {
      option.push(speed)
    }
    return option
  }

  // フリックの場合
  // option: [width (, offsetNumer, offsetDenom (, speed (, orbit)))]
  else if ([3, 4, 6, 7].includes(note.type)) {
    option.push(note.option[0] ? String(note.option[0]) : '-1')
    if (note.option[1] && note.option[2]) {
      option.push(String(note.option[1]), String(note.option[2]))
      if (note.option[3]) {
        option.push(String(note.option[3]))
        if (note.option[4]) option.push(String(note.option[4]))
      }
    }
    return option
  }

  // 音札の場合
  // option: [(speed)]
  else if ([5].includes(note.type)) {
    if (note.option[0]) option.push(String(note.option[0]))
    return option
  }

  // テクスチャの場合
  // option: [source, width, height (, offsetNumer, offsetDenom (, speed (, orbit)))]
  else if ([94].includes(note.type)) {
    option.push((note.option[0] as string) || 'texture/202020.png')
    option.push(note.option[1] ? String(note.option[1]) : '1')   // type94 テクスチャのデフォルト幅は 1
    option.push(note.option[2] ? String(note.option[2]) : '0.25') // type94 テクスチャのデフォルト高さは 0.25
    // offsetNumer, offsetDenom
    if (note.option[3] && note.option[4]) {
      option.push(String(note.option[3]), String(note.option[4]))
      if (note.option[5] !== undefined) {
        option.push(String(note.option[5]))
        if (note.option[6] !== undefined) option.push(String(note.option[6]))
      }
    }
    return option
  }

  // 区切り線の場合
  // option: [length (, speed (, orbit))]
  else if ([95].includes(note.type)) {
    if (note.type === 95 && note.position === 0) return ['-1']
    option.push(note.option[0] ? String(note.option[0]) : '1')
    if (note.option[1]) {
      option.push(String(note.option[1]))
      if (note.option[2]) option.push(String(note.option[2]))
    }
    return option
  }

  // 拍子変化、BPM変化の場合
  else if ([97, 98].includes(note.type)) {
    option.push(note.option[0] ? String(note.option[0]) : '-1')
    return option
  }

  // LED制御の場合
  // option: [r, g, b]
  else if ([96].includes(note.type)) {
    option.push(String(note.option[0]), String(note.option[1]), String(note.option[2]))
    return option
  }

  // コメントの場合
  else if ([100].includes(note.type)) {
    option.push(note.option?.[0] ? String(note.option[0]) : '')
    return option
  }

  // 不明なtypeの時は全部Stringにしてそのまま返す
  else return [...note.option].map(opt => String(opt))
}

/**
 * ノートをバリデーション・正規化して返す純粋関数
 * @param note - バリデーションするノート
 */
export function getValidatedNote(note: NoteData): NoteData {
  const type = Number(note.type)

  // type: 5 は lane: 3
  // type: 96, 97, 98, 99 は lane: -1
  let lane = Number(note.lane) as 1 | 2 | 3 | 4 | 5 | -1
  if (type === 5) lane = 3
  if ([96, 97, 98, 99].includes(type)) lane = -1

  // ロング、ロングダミー、または終点ネストを持つ場合は再帰的にバリデーション
  let end: NoteData[] = []
  if (
    note.type === 2 ||
    (note.type === 90 && note.option[0] === '2') ||
    (note.end && Array.isArray(note.end) && note.end.length > 0)
  ) {
    end = [...note.end].map(getValidatedNote)
  }

  return {
    type,
    measure: Number(note.measure),
    lane,
    position: Number(note.position),
    split: Number(note.split),
    option: getValidatedOptions(note),
    end,
  }
}

/**
 * lane: -1 固定ノートであるか
 * @param note - 検査するノート
 */
export function isLanelessNote(note: NoteData): boolean {
  return [5, 92, 93, 96, 97, 98, 99].includes(note.type)
}
