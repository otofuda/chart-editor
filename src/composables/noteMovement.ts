import type { NoteData } from 'chart-types'
import type { ExtendedNoteData, Measure } from '@/types'

/** ドラッグの確定先。配置欄の移動は譜面や選択状態から独立させる。 */
export type NoteMoveSource = 'chart' | 'draft'

/** ダミーノーツの場合は擬態先、それ以外は自身のノーツ種別を返す。 */
export function effectiveNoteType(note: NoteData): number {
  return note.type === 90 ? Number(note.option[0]) : note.type
}

/** 配置前は音札の縦移動も許可し、挿入済みの音札はドラッグ対象から除く。 */
export function canDragNote(note: NoteData, source: NoteMoveSource = 'chart'): boolean {
  return source === 'draft' || effectiveNoteType(note) !== 5
}

/** ノーツの実際の種別を基に、横方向へ移動できるかを判定する。 */
export function hasMovableLane(note: NoteData): boolean {
  return [1, 2, 3, 4, 6, 7, 89, 94, 95].includes(effectiveNoteType(note))
}

/** ロングノーツまたはロングに擬態するダミーの始点かを判定する。 */
function isLong(note: NoteData): boolean {
  return effectiveNoteType(note) === 2
}

/** 元データを変更せずに候補を編集できるよう、オプションと子ノーツも複製する。 */
function cloneNote<T extends NoteData>(note: T): T {
  return {
    ...note,
    option: [...note.option],
    end: note.end.map(cloneNote),
  }
}

/** 分母の異なるノーツの間隔を、浮動小数点の丸めなしで表す分数。 */
type Fraction = {
  /** 分子。 */
  n: bigint
  /** 正の分母。 */
  d: bigint
}

/** 分数の約分に使う最大公約数を求める。 */
function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a

  while (b) {
    [a, b] = [b, a % b]
  }

  return a
}

/** 正の分母を検証し、約分した分数を生成する。 */
function fraction(n: bigint, d = 1n): Fraction {
  if (d <= 0n) {
    throw new Error('不正な split です。')
  }

  const common = gcd(n, d)
  return { n: n / common, d: d / common }
}

/** 二つの分数を加算し、約分した結果を返す。 */
function add(a: Fraction, b: Fraction): Fraction {
  return fraction(a.n * b.d + b.n * a.d, a.d * b.d)
}

/** 小節番号と小節内位置を、小節単位の正確な時刻に変換する。 */
function time(note: NoteData): Fraction {
  if (
    ![note.measure, note.position, note.split].every(Number.isSafeInteger) ||
    note.split <= 0
  ) {
    throw new Error('小節・position・split には有効な整数が必要です。')
  }

  return fraction(
    BigInt(note.measure) * BigInt(note.split) + BigInt(note.position),
    BigInt(note.split),
  )
}

/** 二つの時刻の前後関係を、負・ゼロ・正の値で返す。 */
function compare(a: Fraction, b: Fraction): bigint {
  return a.n * b.d - b.n * a.d
}

/**
 * 元の split と移動先の分母の最小公倍数を使い、候補ノーツの時刻を更新する。
 *
 * @param note 時刻を書き換える移動候補
 * @param value 小節単位で表した移動先の時刻
 * @throws 譜面の先頭より前、または安全な整数で表せない時刻の場合
 */
function applyTime(note: NoteData, value: Fraction): void {
  if (value.n < 0n) {
    throw new Error('譜面の先頭より前には移動できません。')
  }

  const measure = value.n / value.d
  const oldSplit = BigInt(note.split)
  const split = oldSplit / gcd(oldSplit, value.d) * value.d
  const position = value.n % value.d * (split / value.d)

  if (![measure, split, position].every(v => v <= BigInt(Number.MAX_SAFE_INTEGER))) {
    throw new Error('移動先を正確に表せる split の範囲を超えています。')
  }

  Object.assign(note, {
    measure: Number(measure),
    position: Number(position),
    split: Number(split),
  })
}

/** 元のノーツと、複製したノーツツリー内の位置を対応付ける移動対象。 */
type Target = {
  source: NoteData
  /** 移動セッションの roots 配列における添字。 */
  root: number
  /** 始点から目的のノーツまでたどる end 配列の添字列。 */
  path: number[]
  longNode: boolean
}

/** ドラッグ開始時の対象、座標、小節情報を保持するスナップショット。 */
export type NoteMoveSession = {
  source: NoteMoveSource
  roots: { source: ExtendedNoteData; before: ExtendedNoteData }[]
  targets: Target[]
  anchor: Target
  anchorBefore: NoteData
  measures: Measure[]
  split: number
  /** 選択ノーツの一括移動、またはロング全体の移動として位置関係を保つか。 */
  group: boolean
}

/** 描画用の移動候補と確定時の更新内容。移動できない場合は error に理由を保持する。 */
export type NoteMoveCandidate = {
  source: NoteMoveSource
  roots: ExtendedNoteData[]
  changes: { source: NoteData; value: NoteData }[]
  anchor: NoteData
  error: string | null
}

/** end 配列の添字列をたどり、ノーツツリー内の対象を取得する。 */
function atPath(root: NoteData, path: number[]): NoteData {
  return path.reduce((node, index) => node.end[index], root)
}

/**
 * 掴んだノーツと選択状態から移動対象を集め、開始時の状態を保存する。
 *
 * @param chart 現在の難易度のノーツ一覧
 * @param root 掴んだ点を所有する始点ノーツ
 * @param node 直接掴んだ始点・中点・終点
 * @param measures ドラッグ開始時に表示されている小節情報
 * @param split 縦位置の吸着に使う分割数
 * @param whole ロングの帯から、始点・中点・終点をまとめて移動するか
 * @param source 譜面のノーツか、配置欄のシャドーか
 * @returns 移動セッション。対象外のノーツの場合は null
 */
export function createNoteMoveSession(
  chart: ExtendedNoteData[],
  root: ExtendedNoteData,
  node: NoteData,
  measures: Measure[],
  split: number,
  whole = false,
  source: NoteMoveSource = 'chart',
): NoteMoveSession | null {
  if (!canDragNote(root, source) || (source === 'chart' && !chart.includes(root))) {
    return null
  }

  const selectedGroup = source === 'chart' && node === root && Boolean(root.isSelected)
  const group = selectedGroup || (whole && node === root && isLong(root))
  const roots = (selectedGroup ? chart.filter(n => n.isSelected && canDragNote(n)) : [root])
    .map(source => ({ source, before: cloneNote(source) }))
  const targets: Target[] = []
  let anchor: Target | undefined

  roots.forEach(({ source }, rootIndex) => {
    /** ロングの子ノーツを再帰的にたどり、個別または一括操作の対象を集める。 */
    function visit(current: NoteData, path: number[]) {
      if (group || current === node) {
        const target = {
          source: current,
          root: rootIndex,
          path,
          longNode: isLong(source),
        }

        targets.push(target)

        if (current === node) {
          anchor = target
        }
      }

      if (isLong(source)) {
        current.end.forEach((child, i) => visit(child, [...path, i]))
      }
    }

    visit(source, [])
  })

  if (!anchor) {
    return null
  }

  return {
    source,
    roots,
    targets,
    anchor,
    anchorBefore: cloneNote(node),
    measures: measures.map(m => ({ ...m })),
    split,
    group,
  }
}

/**
 * ノーツの位置を、譜面下端を基準とする上向きのピクセル座標に変換する。
 *
 * @returns ノーツの下端座標。対応する小節が存在しない場合は NaN
 */
export function noteBottom(note: NoteData, measures: Measure[]): number {
  const measure = measures.find(m => m.measure === note.measure)

  return measure
    ? measure.measurePositionBottom + note.position / note.split * measure.measureHeight
    : NaN
}

/** 表示中の小節から移動先を探し、指定した split の最寄りの位置に吸着させる。 */
function snappedTime(bottom: number, split: number, measures: Measure[]): NoteData {
  if (!Number.isSafeInteger(split) || split <= 0) {
    throw new Error('split には正の整数を指定してください。')
  }

  const measure = measures.find(m =>
    m.measureHeight > 0 &&
    bottom >= m.measurePositionBottom &&
    bottom < m.measurePositionBottom + m.measureHeight,
  )

  if (!measure) {
    throw new Error('表示中の小節の範囲内に移動してください。')
  }

  let position = Math.round((bottom - measure.measurePositionBottom) / measure.measureHeight * split)
  let targetMeasure = measure.measure

  if (position === split) {
    // 高さゼロの小節は画面上で掴めないので、境界の次の表示小節に吸着する。
    const next = measures.find(m => m.measure > targetMeasure && m.measureHeight > 0)
    if (!next) {
      throw new Error('表示中の小節の範囲内に移動してください。')
    }

    targetMeasure = next.measure
    position = 0
  }

  return {
    type: 1,
    lane: 1,
    measure: targetMeasure,
    position,
    split,
    option: [],
    end: [],
  }
}

/**
 * 元データを変更せずに移動候補を計算し、範囲とロングの時間順序を検証する。
 *
 * @param session ドラッグ開始時の状態
 * @param deltaX 右向きを正とする横方向の移動量（ピクセル）
 * @param deltaY 上向きを正とする縦方向の移動量（ピクセル）
 * @param moveX 横方向の吸着と移動を行うか
 * @param moveY 縦方向の吸着と移動を行うか
 * @returns 描画・確定に使う移動候補。無効な移動の場合はエラー理由も含む
 */
export function calculateNoteMove(
  session: NoteMoveSession,
  deltaX: number,
  deltaY: number,
  moveX: boolean,
  moveY: boolean,
): NoteMoveCandidate {
  const roots = session.roots.map(r => cloneNote(r.before))
  const changes = session.targets.map(target => ({
    source: target.source,
    value: atPath(roots[target.root], target.path),
  }))
  const anchor = atPath(roots[session.anchor.root], session.anchor.path)
  const result: NoteMoveCandidate = {
    source: session.source,
    roots,
    changes,
    anchor,
    error: null,
  }

  try {
    let shift = fraction(0n)
    let snapped: NoteData | undefined

    if (moveY) {
      snapped = snappedTime(
        noteBottom(session.anchorBefore, session.measures) + deltaY,
        session.split,
        session.measures,
      )

      const oldTime = time(session.anchorBefore)
      shift = add(time(snapped), { n: -oldTime.n, d: oldTime.d })
    }

    // 一括移動では小数レーンの形状も保つため、整数のレーン差を全対象に適用する。
    const laneShift = session.group || !hasMovableLane(session.anchorBefore)
      ? Math.round(deltaX / 60)
      : Math.round(session.anchorBefore.lane + deltaX / 60) - session.anchorBefore.lane

    changes.forEach(({ value }) => {
      if (session.source === 'draft' && effectiveNoteType(value) === 5) {
        value.lane = 3
      }

      if (moveY) {
        applyTime(value, add(time(value), shift))
      }

      if (moveX && hasMovableLane(value)) {
        value.lane = (
          Math.round((value.lane + laneShift) * 1e10) / 1e10
        ) as NoteData['lane']
      }
    })

    if (snapped) {
      Object.assign(anchor, {
        measure: snapped.measure,
        position: snapped.position,
        split: snapped.split,
      })
    }

    session.targets.forEach((target, i) => {
      const value = changes[i].value
      const measure = session.measures.find(m => m.measure === value.measure)

      if (!measure || (moveY && measure.measureHeight <= 0)) {
        throw new Error('表示中の小節の範囲内に移動してください。')
      }

      const t = time(value)

      if (
        value.measure < 0 ||
        value.position < 0 ||
        value.position >= value.split ||
        t.n < 0n
      ) {
        throw new Error('移動先の時刻が不正です。')
      }

      if (moveX && hasMovableLane(value)) {
        const ordinary = effectiveNoteType(value) === 1 && !target.longNode
        const min = ordinary || (target.longNode && !session.group) ? 1 : 0
        const max = ordinary || (target.longNode && !session.group) ? 5 : 6

        if (
          !Number.isFinite(value.lane) ||
          value.lane < min ||
          value.lane > max ||
          (!target.longNode && !Number.isInteger(value.lane))
        ) {
          throw new Error(`レーンは ${min}〜${max} の範囲内に移動してください。`)
        }
      }
    })

    roots.filter(isLong).forEach(root => {
      /** 分岐を含むすべての親子について、子が親より後の時刻にあることを確かめる。 */
      function check(parent: NoteData) {
        parent.end.forEach(child => {
          if (compare(time(child), time(parent)) <= 0n) {
            throw new Error('ロングの中点・終点は親ノーツより後に配置してください。')
          }

          check(child)
        })
      }

      check(root)
    })
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'この位置には移動できません。'
  }

  return result
}

/** エラーのない候補について、位置情報だけを元のノーツへ反映する。 */
export function commitNoteMove(candidate: NoteMoveCandidate): void {
  if (candidate.error) {
    return
  }

  candidate.changes.forEach(({ source, value }) => {
    const { measure, position, split, lane } = value
    Object.assign(source, { measure, position, split, lane })
  })
}
