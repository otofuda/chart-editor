import { describe, expect, it } from 'vitest'
import type { ExtendedNoteData, Measure } from '@/types'
import {
  calculateNoteMove,
  canDragNote,
  commitNoteMove,
  createNoteMoveSession,
  noteBottom,
} from '../noteMovement'

/** テストごとの差分だけを指定して、移動対象のノーツを作る。 */
function note(overrides: Partial<ExtendedNoteData> = {}): ExtendedNoteData {
  return {
    type: 1,
    lane: 2,
    measure: 0,
    position: 1,
    split: 4,
    option: [],
    end: [],
    ...overrides,
  }
}

/** 指定した小節高さを積み上げ、座標計算用の小節情報を作る。 */
function measures(heights = [400, 300, 400]): Measure[] {
  let bottom = 0

  return heights.map((height, measure) => {
    const result = {
      measure,
      measureHeight: height,
      measurePositionBottom: bottom,
      measureBeat: height / 100,
      measureBpm: 120,
      measureReachTime: 0,
      measureLength: 1000,
    }

    bottom += height
    return result
  })
}

/** 先頭のノーツを所有元として、計算の検証に使う移動セッションを作る。 */
function setup(notes: ExtendedNoteData[], split = 8, node = notes[0]) {
  return createNoteMoveSession(notes, notes[0], node, measures(), split)!
}

/** ノーツ間の間隔を比較するため、小節単位の時刻を返す。 */
function timing(n: ExtendedNoteData) {
  return n.measure + n.position / n.split
}

describe('ドラッグ移動の計算', () => {
  it('移動先に吸着しても確定までは元データを変更しない', () => {
    const source = note()
    const candidate = calculateNoteMove(setup([source]), 61, 48, true, true)
    expect(candidate.error).toBeNull()
    expect(source).toMatchObject({ lane: 2, position: 1, split: 4 })
    expect(candidate.anchor).toMatchObject({ lane: 3, position: 3, split: 8 })
    commitNoteMove(candidate)
    expect(source).toMatchObject({ lane: 3, position: 3, split: 8 })
  })

  it('配置欄と対象ノーツの split をそれぞれ使える', () => {
    const source = note()
    expect(calculateNoteMove(setup([source], 8), 0, 60, false, true).anchor.position).toBe(3)
    expect(calculateNoteMove(setup([source], source.split), 0, 60, false, true).anchor.position).toBe(2)
  })

  it('横だけの移動は時刻を、縦だけの移動は小数レーンを保持する', () => {
    const source = note({
      type: 2,
      lane: 2.5 as ExtendedNoteData['lane'],
      split: 12,
      position: 1,
      end: [note({ measure: 1 })],
    })
    const session = setup([source])
    expect(calculateNoteMove(session, 40, 0, true, false).anchor).toMatchObject({
      lane: 3,
      position: 1,
      split: 12,
    })
    expect(calculateNoteMove(session, 0, 60, false, true).anchor.lane).toBe(2.5)
  })

  it('小節境界と異なる小節高さで吸着する', () => {
    const source = note({ position: 3 })
    const session = setup([source])
    expect(calculateNoteMove(session, 0, 90, false, true).anchor).toMatchObject({ measure: 1, position: 0 })
    expect(calculateNoteMove(session, 0, 210, false, true).anchor).toMatchObject({
      measure: 1,
      position: 3,
      split: 8,
    })
    expect(noteBottom(source, measures())).toBe(300)
  })

  it('高さゼロの小節は飛ばし、表示範囲の外にはドロップできない', () => {
    const source = note({ position: 3 })
    const session = createNoteMoveSession([source], source, source, measures([400, 0, 400]), 8)!
    expect(calculateNoteMove(session, 0, 90, false, true).anchor).toMatchObject({ measure: 2, position: 0 })
    for (const dy of [-301, 501]) {
      const candidate = calculateNoteMove(session, 0, dy, false, true)
      expect(candidate.error).toBeTruthy()
      commitNoteMove(candidate)
      expect(source.measure).toBe(0)
    }
  })

  it.each([0, -1, 1.5, NaN, Infinity])('不正な split %s では縦移動を確定しない', split => {
    const source = note()
    const candidate = calculateNoteMove(setup([source], split), 0, 50, false, true)
    expect(candidate.error).toBeTruthy()
    commitNoteMove(candidate)
    expect(source.position).toBe(1)
  })

  it('異なる split の一括移動で間隔を厳密に保つ', () => {
    const a = note({ isSelected: true, split: 3, position: 1 })
    const b = note({ isSelected: true, split: 7, position: 1, lane: 3 })
    const candidate = calculateNoteMove(setup([a, b], 8), 60, 20, true, true)
    expect(candidate.error).toBeNull()
    expect(candidate.anchor).toMatchObject({ position: 3, split: 8 })
    expect(candidate.changes[1].value).toMatchObject({ position: 31, split: 168, lane: 4 })
    expect(
      timing(candidate.changes[1].value) - timing(candidate.anchor),
    ).toBeCloseTo(timing(b) - timing(a), 14)
    commitNoteMove(candidate)
    expect(b).toMatchObject({ position: 31, split: 168 })
  })

  it('チェックされていないノーツを掴むと他の選択ノーツは移動しない', () => {
    const a = note()
    const b = note({ isSelected: true, lane: 4 })
    const candidate = calculateNoteMove(setup([a, b]), 60, 0, true, false)
    commitNoteMove(candidate)
    expect(a.lane).toBe(3)
    expect(b.lane).toBe(4)
  })

  it('ロングの始点だけを移動し、子のオプションと位置を保持する', () => {
    const child = note({ measure: 1, option: ['1', '0', 'ease', '2'] })
    const root = note({ type: 2, end: [child] })
    commitNoteMove(calculateNoteMove(setup([root]), 60, 50, true, true))
    expect(root).toMatchObject({ lane: 3, position: 3, split: 8 })
    expect(child).toMatchObject({ lane: 2, measure: 1, option: ['1', '0', 'ease', '2'] })
  })

  it('選択された分岐ロング全体を形状を保って移動する', () => {
    const child = note({
      type: 89,
      lane: 2.5 as ExtendedNoteData['lane'],
      measure: 1,
      end: [note({ measure: 2 })],
    })
    const root = note({
      type: 90,
      option: ['2'],
      isSelected: true,
      end: [child, note({ measure: 1, lane: 3 })],
    })
    const session = setup([root])
    expect(session.targets).toHaveLength(4)
    const candidate = calculateNoteMove(session, 60, 50, true, true)
    expect(candidate.error).toBeNull()
    commitNoteMove(candidate)
    expect(child).toMatchObject({ lane: 3.5, measure: 1, position: 3, split: 8 })
    expect(root.end[1].lane).toBe(4)
    expect(child.end[0].lane).toBe(3)
    expect(root.option).toEqual(['2'])
  })

  it('選択中でも中点を直接掴むとその点だけを移動する', () => {
    const child = note({ type: 89, measure: 1, end: [note({ measure: 2 })] })
    const root = note({ type: 2, isSelected: true, end: [child] })
    const candidate = calculateNoteMove(setup([root], 8, child), 60, 50, true, true)
    expect(candidate.error).toBeNull()
    expect(candidate.changes).toHaveLength(1)
    commitNoteMove(candidate)
    expect(child.lane).toBe(3)
    expect(root.lane).toBe(2)
    expect(child.end[0].lane).toBe(2)
  })

  it('未選択のロングの帯から、異なる split の中点・終点を間隔を保って移動する', () => {
    const child = note({ measure: 1, position: 1, split: 7 })
    const root = note({ type: 2, position: 1, split: 3, end: [child] })
    const session = createNoteMoveSession([root], root, root, measures(), 8, true)!
    const candidate = calculateNoteMove(session, 60, 20, true, true)

    expect(candidate.error).toBeNull()
    expect(candidate.changes).toHaveLength(2)
    commitNoteMove(candidate)

    expect(root).toMatchObject({ lane: 3, position: 3, split: 8 })
    expect(child).toMatchObject({ lane: 3, measure: 1, position: 31, split: 168 })
  })

  it('帯からの移動で終点が範囲外になる場合は、ロング全体の変更を取り消す', () => {
    const child = note({ measure: 1, lane: 6 as ExtendedNoteData['lane'] })
    const root = note({ type: 2, end: [child] })
    const session = createNoteMoveSession([root], root, root, measures(), 8, true)!
    const candidate = calculateNoteMove(session, 60, 50, true, true)

    expect(candidate.error).toContain('レーン')
    commitNoteMove(candidate)

    expect(root).toMatchObject({ lane: 2, position: 1, split: 4 })
    expect(child).toMatchObject({ lane: 6, measure: 1, position: 1, split: 4 })
  })

  it('ロングの親子順序が逆転または一致する場合は操作全体を取り消す', () => {
    const root = note({ type: 2, end: [note({ position: 2 })] })
    for (const dy of [100, 150]) {
      const candidate = calculateNoteMove(setup([root]), 60, dy, true, true)
      expect(candidate.error).toContain('親ノーツ')
      commitNoteMove(candidate)
      expect(root.lane).toBe(2)
    }
  })

  it('一括移動の1点がレーン範囲外なら全対象を取り消す', () => {
    const a = note({ isSelected: true })
    const b = note({ isSelected: true, lane: 5 })
    const candidate = calculateNoteMove(setup([a, b]), 60, 50, true, true)
    expect(candidate.error).toContain('レーン')
    commitNoteMove(candidate)
    expect(a).toMatchObject({ lane: 2, position: 1 })
  })

  it.each([5, 90])('音札と音札ダミー(type %s)を一括対象から除く', type => {
    const source = note({ type, option: type === 90 ? ['5'] : [], isSelected: true })
    const a = note({ isSelected: true })
    expect(canDragNote(source)).toBe(false)
    expect(createNoteMoveSession([source], source, source, measures(), 8)).toBeNull()
    const candidate = calculateNoteMove(setup([a, source]), 60, 50, true, true)
    commitNoteMove(candidate)
    expect(source).toMatchObject({ position: 1, split: 4 })
    expect(a.lane).toBe(3)
  })

  it.each([91, 92, 93, 96, 97, 98, 99, 100])('制御オブジェクト type %s は横位置を保持する', type => {
    const source = note({ type, lane: -1, option: ['4'], isSelected: true })
    const other = note({ isSelected: true })
    const candidate = calculateNoteMove(setup([source, other]), 60, 50, true, true)
    expect(candidate.error).toBeNull()
    commitNoteMove(candidate)
    expect(source).toMatchObject({ lane: -1, position: 3, split: 8 })
    expect(other.lane).toBe(3)
  })

  it.each([3, 4, 6, 7, 94, 95, 90])('幅やオフセットを持つ type %s のオプションを保持する', type => {
    const source = note({ type, option: type === 90 ? ['3', '3', '1', '2'] : ['3', '1', '2'] })
    const options = [...source.option]
    const candidate = calculateNoteMove(setup([source]), 60, 50, true, true)
    expect(candidate.error).toBeNull()
    commitNoteMove(candidate)
    expect(source.option).toEqual(options)
  })

  it('他ノーツとの重複を許可する', () => {
    const a = note({ index: 1 })
    const b = note({ index: 2, lane: 3 })
    const candidate = calculateNoteMove(setup([a, b]), 60, 0, true, false)
    expect(candidate.error).toBeNull()
    commitNoteMove(candidate)
    expect(a.lane).toBe(b.lane)
  })
})
