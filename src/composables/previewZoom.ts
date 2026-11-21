import type { Measure } from '../types'

/**
 * ハイスピード変更前後で保持する、プレビュー中央の基準位置。
 * 小節領域の内側は小節番号と小節内の位置比率で表し、領域外の余白は固定ピクセル差分で表す。
 */
export type PreviewZoomAnchor =
  | {
      /** 通常小節または停止・瞬間移動小節内の位置を示す種別。 */
      kind: 'measure'
      /** 基準となる小節の配列インデックス。 */
      measureIndex: number
      /** 小節下端から上端までの相対位置（0〜1）。 */
      progress: number
    }
  | {
      /** 0小節より下のオフセット余白内の位置を示す種別。 */
      kind: 'offset'
      /** オフセット余白全体に対する下端からの比率（0〜1）。 */
      ratio: number
    }
  | {
      /** 譜面下端より下の余白（LIFT等）にある位置を示す種別。 */
      kind: 'below'
      /** 譜面下端からの固定ピクセル差分（負の値）。 */
      offsetPx: number
    }
  | {
      /** 譜面上端より上の余白にある位置を示す種別。 */
      kind: 'above'
      /** 譜面上端からの固定ピクセル差分（正の値）。 */
      offsetPx: number
    }

/** ズーム基準位置の算出に必要な、表示領域の寸法とスクロール情報。 */
export interface PreviewZoomViewport {
  /** 現在の縦スクロール量（px）。 */
  scrollTop: number
  /** プレビュー表示領域の高さ（px）。 */
  viewportHeight: number
  /** スクロール領域先頭から譜面領域（.preview）視覚上端までのオフセット（px）。 */
  contentTop: number
}

/**
 * 譜面全体の描画高さ（px）を最後の小節情報から求める。
 *
 * @param measures 小節情報の配列
 * @returns 譜面全体の高さ（px）。小節がない場合は0
 */
export function getEntireChartHeight(measures: Measure[]): number {
  const last = measures.at(-1)

  if (!last) {
    return 0
  }

  return last.measurePositionBottom + last.measureHeight
}

/**
 * 譜面下端基準の座標が属する小節と小節内比率を求める。
 * 停止小節（高さ0）の境界では、高さを持つ小節を優先して基準を安定させる。
 *
 * @param measures 小節情報の配列
 * @param bottomPx 譜面下端からの距離（px）
 * @returns 対応する小節アンカー
 */
function findMeasureAnchor(measures: Measure[], bottomPx: number): PreviewZoomAnchor {
  // 高さを持つ小節を優先し、停止小節との境界でも正確な比率で復元できるようにする。
  for (let index = 0; index < measures.length; index++) {
    const measure = measures[index]

    if (measure.measureHeight <= 0) {
      continue
    }

    const topPx = measure.measurePositionBottom + measure.measureHeight

    if (bottomPx >= measure.measurePositionBottom && bottomPx <= topPx) {
      const progress = (bottomPx - measure.measurePositionBottom) / measure.measureHeight

      return {
        kind: 'measure',
        measureIndex: index,
        progress: Math.min(1, Math.max(0, progress)),
      }
    }
  }

  // 全小節が高さ0の境界や浮動小数誤差で区間外になった場合は、直前の小節を基準にする。
  let fallbackIndex = 0

  for (let index = 0; index < measures.length; index++) {
    if (measures[index].measurePositionBottom <= bottomPx) {
      fallbackIndex = index
    }
  }

  return {
    kind: 'measure',
    measureIndex: fallbackIndex,
    progress: 0,
  }
}

/**
 * 現在のスクロール位置と小節情報から、表示領域中央の小節位置をアンカーとして記録する。
 *
 * @param measures 変更前の小節情報の配列
 * @param viewport 変更前の表示領域とスクロール情報
 * @param beatHeight 変更前の1拍あたりの高さ（px）
 * @returns 記録したアンカー。高さ0や不正値で基準を特定できない場合はnull
 */
export function capturePreviewZoomAnchor(
  measures: Measure[],
  viewport: PreviewZoomViewport,
  beatHeight: number,
): PreviewZoomAnchor | null {
  if (measures.length === 0) {
    return null
  }

  if (!Number.isFinite(beatHeight) || beatHeight <= 0) {
    return null
  }

  if (
    !Number.isFinite(viewport.scrollTop) ||
    !Number.isFinite(viewport.viewportHeight) ||
    viewport.viewportHeight <= 0 ||
    !Number.isFinite(viewport.contentTop)
  ) {
    return null
  }

  const first = measures[0]
  const entireHeight = getEntireChartHeight(measures)
  const minBottom = Math.min(0, first.measurePositionBottom)

  if (!Number.isFinite(entireHeight) || !Number.isFinite(minBottom)) {
    return null
  }

  if (entireHeight <= minBottom) {
    return null
  }

  const centerInScroll = viewport.scrollTop + viewport.viewportHeight / 2
  const centerBottom = entireHeight - (centerInScroll - viewport.contentTop)

  if (centerBottom < minBottom) {
    return {
      kind: 'below',
      offsetPx: centerBottom - minBottom,
    }
  }

  if (centerBottom > entireHeight) {
    return {
      kind: 'above',
      offsetPx: centerBottom - entireHeight,
    }
  }

  if (first.measurePositionBottom > 0 && centerBottom < first.measurePositionBottom) {
    return {
      kind: 'offset',
      ratio: centerBottom / first.measurePositionBottom,
    }
  }

  return findMeasureAnchor(measures, centerBottom)
}

/**
 * 記録したアンカーの小節位置を、変更後の小節情報で表示領域中央に保つスクロール位置（px）へ変換する。
 *
 * @param anchor 記録しておいた中央の基準位置
 * @param measures 変更後の小節情報の配列
 * @param viewportHeight プレビュー表示領域の高さ（px）
 * @param contentTop スクロール領域先頭から譜面領域視覚上端までのオフセット（px）
 * @returns 復元先の縦スクロール位置（0以上）。計算できない場合はnull
 */
export function resolvePreviewZoomScrollTop(
  anchor: PreviewZoomAnchor,
  measures: Measure[],
  viewportHeight: number,
  contentTop: number,
): number | null {
  if (measures.length === 0) {
    return null
  }

  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0 || !Number.isFinite(contentTop)) {
    return null
  }

  const first = measures[0]
  const entireHeight = getEntireChartHeight(measures)
  const minBottom = Math.min(0, first.measurePositionBottom)

  if (!Number.isFinite(entireHeight) || !Number.isFinite(minBottom)) {
    return null
  }

  let targetBottom: number

  if (anchor.kind === 'below') {
    targetBottom = minBottom + anchor.offsetPx
  } else if (anchor.kind === 'above') {
    targetBottom = entireHeight + anchor.offsetPx
  } else if (anchor.kind === 'offset') {
    targetBottom = first.measurePositionBottom * anchor.ratio
  } else {
    const measure = measures[anchor.measureIndex]

    if (!measure) {
      return null
    }

    targetBottom = measure.measurePositionBottom + anchor.progress * measure.measureHeight
  }

  const rawScrollTop = contentTop + entireHeight - targetBottom - viewportHeight / 2

  if (!Number.isFinite(rawScrollTop)) {
    return null
  }

  return Math.max(0, rawScrollTop)
}
