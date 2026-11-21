import { describe, expect, it } from 'vitest'
import type { Measure } from '../../types'
import {
  capturePreviewZoomAnchor,
  getEntireChartHeight,
  resolvePreviewZoomScrollTop,
} from '../previewZoom'

/** 指定条件の均一な小節配列を生成するテストヘルパー。 */
function createMeasures(
  count: number,
  beatHeight: number,
  options: { beat?: number; bpm?: number; offsetMs?: number } = {},
): Measure[] {
  const beat = options.beat ?? 4
  const bpm = options.bpm ?? 120
  const offsetMs = options.offsetMs ?? 0
  const measureHeight = beatHeight * beat
  const measureLength = (60 / bpm) * beat * 1000
  const offsetPx = (offsetMs / ((60 / bpm) * 1000)) * beatHeight

  return Array.from({ length: count }, (_, measure) => ({
    measure,
    measureBpm: bpm,
    measureBeat: beat,
    measureReachTime: offsetMs + measure * measureLength,
    measurePositionBottom: offsetPx + measure * measureHeight,
    measureHeight,
    measureLength,
  }))
}

/** 変拍子・停止・瞬間移動を含む小節配列を生成するテストヘルパー。 */
function createMixedMeasures(beatHeight: number): Measure[] {
  const definitions = [
    { beat: 4, heightBeats: 4, lengthMs: 2000 },
    { beat: 3, heightBeats: 3, lengthMs: 1500 },
    { beat: 4, heightBeats: 0, lengthMs: 2000 }, // 停止小節（高さ0）
    { beat: 4, heightBeats: 2, lengthMs: 0 }, // 瞬間移動小節（時間0）
    { beat: 4, heightBeats: 4, lengthMs: 2000 },
  ]

  let bottom = 0
  let reachTime = 0

  return definitions.map((def, measure) => {
    const measureHeight = beatHeight * def.heightBeats
    const item: Measure = {
      measure,
      measureBpm: 120,
      measureBeat: def.beat,
      measureReachTime: reachTime,
      measurePositionBottom: bottom,
      measureHeight,
      measureLength: def.lengthMs,
    }

    bottom += measureHeight
    reachTime += def.lengthMs

    return item
  })
}

describe('previewZoom の純粋計算', () => {
  it('小節配列から譜面全体の高さを求める', () => {
    expect(getEntireChartHeight([])).toBe(0)
    expect(getEntireChartHeight(createMeasures(5, 100))).toBe(2000)
    expect(getEntireChartHeight(createMeasures(3, 100, { offsetMs: 500 }))).toBe(1300)
  })

  it('通常小節内の中央位置を、倍率変更後も同じ小節内比率で中央に保つ', () => {
    const before = createMeasures(10, 100) // 1小節400px、全体4000px
    const viewportHeight = 800

    // scrollTop=1900 のとき中央は上端から2300px -> 下端から1700px（4小節の25%位置）
    const anchor = capturePreviewZoomAnchor(
      before,
      { scrollTop: 1900, viewportHeight, contentTop: 0 },
      100,
    )

    expect(anchor).toEqual({
      kind: 'measure',
      measureIndex: 4,
      progress: 0.25,
    })

    // 2倍に拡大（1小節800px、全体8000px）: 4小節25% = 下端から3400px -> 上端から4600px -> scrollTop=4200
    const zoomedIn = resolvePreviewZoomScrollTop(anchor!, createMeasures(10, 200), viewportHeight, 0)
    expect(zoomedIn).toBe(4200)

    // 0.5倍に縮小（1小節200px、全体2000px）: 4小節25% = 下端から850px -> 上端から1150px -> scrollTop=750
    const zoomedOut = resolvePreviewZoomScrollTop(anchor!, createMeasures(10, 50), viewportHeight, 0)
    expect(zoomedOut).toBe(750)
  })

  it('変拍子・停止小節・瞬間移動小節が混在しても、中央の小節位置を正確に保つ', () => {
    const before = createMixedMeasures(100) // 高さ: 400, 300, 0, 200, 400 (全体1300)
    const viewportHeight = 400

    // 停止小節（index 2）の境界 bottom=700 が中央になる位置: scrollTop = 1300 - 700 - 200 = 400
    const boundaryAnchor = capturePreviewZoomAnchor(
      before,
      { scrollTop: 400, viewportHeight, contentTop: 0 },
      100,
    )

    expect(boundaryAnchor).toEqual({
      kind: 'measure',
      measureIndex: 1,
      progress: 1,
    })

    const after = createMixedMeasures(200) // 全体2600、境界は1400
    expect(resolvePreviewZoomScrollTop(boundaryAnchor!, after, viewportHeight, 0)).toBe(1000)

    // 瞬間移動小節（index 3: 700..900）の真ん中 bottom=800 -> scrollTop = 1300 - 800 - 200 = 300
    const warpAnchor = capturePreviewZoomAnchor(
      before,
      { scrollTop: 300, viewportHeight, contentTop: 0 },
      100,
    )

    expect(warpAnchor).toEqual({
      kind: 'measure',
      measureIndex: 3,
      progress: 0.5,
    })
    expect(resolvePreviewZoomScrollTop(warpAnchor!, after, viewportHeight, 0)).toBe(800)
  })

  it('正のオフセット余白内や負のオフセットがある場合も中央位置を保つ', () => {
    // BPM120でoffset=1000msは2拍分（beatHeight=100で200px、beatHeight=200で400px）
    const positiveBefore = createMeasures(5, 100, { offsetMs: 1000 }) // 全体2200px
    const viewportHeight = 400

    // bottom=100（オフセット余白の中央）: scrollTop = 2200 - 100 - 200 = 1900
    const offsetAnchor = capturePreviewZoomAnchor(
      positiveBefore,
      { scrollTop: 1900, viewportHeight, contentTop: 0 },
      100,
    )

    expect(offsetAnchor).toEqual({ kind: 'offset', ratio: 0.5 })

    const positiveAfter = createMeasures(5, 200, { offsetMs: 1000 }) // 全体4400px、オフセット中央は200px
    expect(resolvePreviewZoomScrollTop(offsetAnchor!, positiveAfter, viewportHeight, 0)).toBe(4000)

    // 負のオフセット（offset=-500ms -> 0小節は -100..300、全体1900px）
    const negativeBefore = createMeasures(5, 100, { offsetMs: -500 })
    // bottom=-50（0小節の12.5%位置）: scrollTop = 1900 - (-50) - 200 = 1750
    const negativeAnchor = capturePreviewZoomAnchor(
      negativeBefore,
      { scrollTop: 1750, viewportHeight, contentTop: 0 },
      100,
    )

    expect(negativeAnchor).toEqual({
      kind: 'measure',
      measureIndex: 0,
      progress: 0.125,
    })

    const negativeAfter = createMeasures(5, 200, { offsetMs: -500 }) // 全体3800px、0小節の12.5%は-100px
    expect(resolvePreviewZoomScrollTop(negativeAnchor!, negativeAfter, viewportHeight, 0)).toBe(3700)
  })

  it('LIFT等の譜面下端より下の余白や描画オフセットを固定ピクセルとして維持する', () => {
    const before = createMeasures(5, 100) // 全体2000px
    const viewportHeight = 800

    // LIFT=500 で最下部までスクロールし、中央が0小節より100px下（bottom=-100）にある状態
    const belowAnchor = capturePreviewZoomAnchor(
      before,
      { scrollTop: 1700, viewportHeight, contentTop: 0 },
      100,
    )

    expect(belowAnchor).toEqual({ kind: 'below', offsetPx: -100 })

    // 2倍に拡大（全体4000px）しても、0小節から100px下の位置（scrollTop=3700）を保つ
    expect(resolvePreviewZoomScrollTop(belowAnchor!, createMeasures(5, 200), viewportHeight, 0)).toBe(3700)

    // drawOffset等で contentTop=-50 がある場合も、同じ小節位置を維持する
    const drawOffsetAnchor = capturePreviewZoomAnchor(
      before,
      { scrollTop: 1000, viewportHeight, contentTop: -50 },
      100,
    )

    // centerInScroll = 1400, offsetFromTop = 1450, centerBottom = 550 (1小節の37.5%)
    expect(drawOffsetAnchor).toEqual({
      kind: 'measure',
      measureIndex: 1,
      progress: 0.375,
    })
    expect(resolvePreviewZoomScrollTop(drawOffsetAnchor!, createMeasures(5, 200), viewportHeight, -50)).toBe(2450)
  })

  it('beatHeight=0を経由して再拡大しても、記憶したアンカーから元の位置へ復元できる', () => {
    const before = createMeasures(6, 100) // 全体2400px
    const viewportHeight = 800
    const anchor = capturePreviewZoomAnchor(
      before,
      { scrollTop: 1000, viewportHeight, contentTop: 0 },
      100,
    )

    // 0に潰れた状態ではスクロール位置は0へ丸められる
    const collapsed = resolvePreviewZoomScrollTop(anchor!, createMeasures(6, 0), viewportHeight, 0)
    expect(collapsed).toBe(0)

    // 元の100へ戻すと完全に元のscrollTop=1000へ戻る
    const restored = resolvePreviewZoomScrollTop(anchor!, createMeasures(6, 100), viewportHeight, 0)
    expect(restored).toBe(1000)
  })

  it('beatHeightが0以下や空の小節配列では不正なアンカーを作らない', () => {
    expect(capturePreviewZoomAnchor([], { scrollTop: 0, viewportHeight: 800, contentTop: 0 }, 100)).toBeNull()
    expect(capturePreviewZoomAnchor(createMeasures(3, 0), { scrollTop: 0, viewportHeight: 800, contentTop: 0 }, 0)).toBeNull()
    expect(capturePreviewZoomAnchor(createMeasures(3, 100), { scrollTop: 0, viewportHeight: 0, contentTop: 0 }, 100)).toBeNull()
    expect(resolvePreviewZoomScrollTop({ kind: 'measure', measureIndex: 99, progress: 0.5 }, createMeasures(3, 100), 800, 0)).toBeNull()
  })
})
