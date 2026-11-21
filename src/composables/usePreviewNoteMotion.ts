import { inject, onBeforeUnmount, type InjectionKey } from 'vue'
import type { NoteData } from 'chart-types'
import { generateHoldSvgPaths, type CurveType } from './useNoteTypes'

/** 画面端での出入りが途切れないよう、可視判定に含める上下の余白（px）。 */
const VIEWPORT_MARGIN = 64

/** 本体の距離をレーン幅60pxへ換算する係数。62.5 × (60 / 2) に相当する。 */
const ORBIT_DISTANCE_COEFFICIENT = 1875

/** フレーム間で共有する、ノーツまたはロング端点の静的な描画情報。 */
export interface MotionPoint {
  /** 譜面全体の下端から測った補正前の縦位置（px）。 */
  bottom: number
  /** ロングの帯を接続する中心の横位置（px）。 */
  left: number
  /** ロングの帯の幅（px）。単独ノーツでは使用しない。 */
  width: number
  /** 判定ラインまでの描画距離に掛ける倍率。 */
  speed: number
  /** 本体の譜面距離に対する横移動量。 */
  orbit: number
}

/** コンポーネントが個別描画へ提供する要素と、その要素の静的な座標。 */
export interface MotionSource {
  nodes?: {
    element: HTMLElement
    point: MotionPoint
    texture?: {
      element: HTMLImageElement
      height: number
    }
  }[]
  segments?: {
    element: SVGGElement
    start: MotionPoint
    end: MotionPoint
    curve: CurveType
    height: number
  }[]
}

/** 個別描画が必要になった時点で、最新の要素と座標を取得する関数。 */
type Source = () => MotionSource

/** Previewから子コンポーネントへ、描画情報の登録窓口を渡すためのキー。 */
export const motionSourceKey: InjectionKey<(source: Source) => () => void> = Symbol('preview-note-motion')

/**
 * 描画情報の取得関数を登録し、コンポーネントの破棄時に登録を解除する。
 * 取得関数はここでは呼ばないため、OFF中に座標の生成やDOM操作は発生しない。
 *
 * @param source 個別描画が有効なときだけ評価する描画情報の取得関数。
 */
export function usePreviewMotionSource(source: Source) {
  const register = inject(motionSourceKey, null)

  if (register) {
    onBeforeUnmount(register(source))
  }
}

/** 空欄や非有限値を既定値へ戻し、数値として利用できるオプションを返す。 */
function finiteOption(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === '') {
    return fallback
  }

  const number = Number(value)

  return Number.isFinite(number) ? number : fallback
}

/**
 * ノーツ種別ごとのオプション位置から、speedとorbitを読み取る。
 * otofuda c225c088のChartParser.csに合わせ、端点orbitと区切り線orbitは拡張として扱う。
 *
 * @param note ダミーの場合は擬態先の種別を含むノーツ。
 * @param endpoint ロングの中点・終点なら、0以下のspeedを本体と同じ1倍へ戻す。
 * @returns 描画倍率と軌道。個別描画の対象外の種別にはnullを返す。
 */
export function getNoteMotion(note: NoteData, endpoint = false) {
  // ダミーの先頭項目は擬態先の種別なので、実際のオプションを一つ後ろから読む。
  const dummy = note.type === 90
  const type = dummy ? Number(note.option[0]) : note.type
  const offset = dummy ? 1 : 0

  let speedIndex: number
  let orbitIndex: number | undefined

  if ([1, 2, 89].includes(type)) {
    speedIndex = 0
    orbitIndex = 1
  } else if ([3, 4, 6, 7].includes(type)) {
    speedIndex = 3
    orbitIndex = 4
  } else if (type === 5) {
    speedIndex = 0
  } else if (type === 94) {
    speedIndex = 5
    orbitIndex = 6
  } else if (type === 95) {
    speedIndex = 1
    orbitIndex = 2
  } else {
    return null
  }

  let speed = finiteOption(note.option[speedIndex + offset], 1)

  if (endpoint && speed <= 0) {
    speed = 1
  }

  return {
    speed,
    orbit: orbitIndex === undefined ? 0 : finiteOption(note.option[orbitIndex + offset], 0),
  }
}

/** 描画距離の換算と、画面内に現れる区間の計算に使用するプレビュー設定。 */
export interface MotionConfig {
  /** エディタ上の1拍の高さ（px）。 */
  beatHeight: number
  /** 途中のBPM変化ではなく、譜面に設定された初期BPM。 */
  bpm: number
  /** プレビューの表示領域の高さ（px）。 */
  viewportHeight: number
  /** 表示領域の下端から判定ラインを押し上げる高さ（px）。 */
  lift: number
  /** 譜面全体に適用される描画位置の調整量（px）。 */
  drawOffset: number
}

/**
 * エディタの縦方向の距離から、orbitによる横方向の距離への換算率を求める。
 * 本体の1拍は62.5/初期BPM、1レーンは2単位なので、1レーン60pxに換算する。
 *
 * @param beatHeight エディタ上の1拍の高さ（px）。
 * @param bpm 譜面の初期BPM。
 * @returns 1pxの縦方向の距離に対する横移動量。表示倍率やBPMが不正なら0を返す。
 */
export function getOrbitScale(beatHeight: number, bpm: number) {
  if (!(beatHeight > 0 && bpm > 0 && Number.isFinite(beatHeight) && Number.isFinite(bpm))) {
    return 0
  }

  return ORBIT_DISTANCE_COEFFICIENT / bpm / beatHeight
}

/**
 * 既存の譜面全体の移動に追加する、ノーツ固有のCSS移動量を求める。
 * CSSでは下方向が正なので、speedが大きいほど縦補正は負の方向へ向かう。
 *
 * @param point 補正前の位置と、そのノーツのspeed・orbit。
 * @param position 現在の判定ラインに対応する譜面全体の縦位置（px）。
 * @param orbitScale 初期BPMと表示倍率から求めた横移動の換算率。
 * @returns CSSのtransformへ渡す横方向と縦方向の追加移動量（px）。
 */
export function getMotionOffset(point: MotionPoint, position: number, orbitScale: number) {
  const distance = point.bottom - position

  return {
    x: distance * point.orbit * orbitScale,
    y: (1 - point.speed) * distance,
  }
}

/** 対象が表示範囲と重なる、譜面全体の縦位置の閉区間。無限区間も許容する。 */
type Interval = [number, number]

/** 一つの描画対象と、フレーム間の可視状態・復元に必要な情報。 */
type Entry = {
  element: HTMLElement | SVGGElement
  draw: (position: number) => void
  seen: number
  visibility: string
  priority: string
  visible: boolean
}

/** 可視区間と描画対象の組。一つの帯が複数の区間を持つ場合もある。 */
type IndexedInterval = {
  range: Interval
  entry: Entry
}

/** 区間の開始位置で並べた木。maxは、その部分木に含まれる終端位置の最大値。 */
type IntervalTree = IndexedInterval & {
  max: number
  left?: IntervalTree
  right?: IntervalTree
}

/**
 * 判定ラインからの高さが指定の範囲に収まる、譜面全体の縦位置の区間を求める。
 * speedが0ならノーツは判定ライン上に留まるため、常に表示するか常に除外する。
 * 負のspeedでは区間の向きが逆転するので、返す両端を小さい順に揃える。
 */
function band(point: MotionPoint, lower: number, upper: number): Interval | undefined {
  if (point.speed === 0) {
    return lower <= 0 && upper >= 0 ? [-Infinity, Infinity] : undefined
  }

  const a = point.bottom - upper / point.speed
  const b = point.bottom - lower / point.speed

  return a <= b ? [a, b] : [b, a]
}

/** 二つの閉区間の共通部分を返す。どちらかが空、または交わらない場合は返さない。 */
function intersection(a?: Interval, b?: Interval): Interval | undefined {
  if (!a || !b) {
    return
  }

  const start = Math.max(a[0], b[0])
  const end = Math.min(a[1], b[1])

  return start <= end ? [start, end] : undefined
}

/** 開始位置で整列した区間から、現在位置での絞り込みに使う平衡木を構築する。 */
function buildTree(
  sorted: IndexedInterval[],
  from = 0,
  to = sorted.length,
): IntervalTree | undefined {
  if (from === to) {
    return
  }

  const middle = (from + to) >>> 1
  const left = buildTree(sorted, from, middle)
  const right = buildTree(sorted, middle + 1, to)

  return {
    ...sorted[middle],
    left,
    right,
    max: Math.max(sorted[middle].range[1], left?.max ?? -Infinity, right?.max ?? -Infinity),
  }
}

/** 現在位置を含む区間だけを訪問し、画面外の部分木の走査を省く。 */
function query(tree: IntervalTree | undefined, position: number, visit: (entry: Entry) => void) {
  if (!tree || tree.max < position) {
    return
  }

  query(tree.left, position, visit)

  if (tree.range[0] > position) {
    return
  }

  if (tree.range[1] >= position) {
    visit(tree.entry)
  }

  query(tree.right, position, visit)
}

/** 等速直進の対象を除き、個別の座標補正が必要かを判定する。 */
function changed(point: MotionPoint) {
  return point.speed !== 1 || point.orbit !== 0
}

/** 非有限な座標がCSSやSVGへ渡らないよう、キャッシュへの登録前に検査する。 */
function valid(point: MotionPoint) {
  return Object.values(point).every(Number.isFinite)
}

/**
 * フレームごとの全件走査・DOM検索・Vue更新を避ける、個別描画専用のキャッシュ。
 * sourcesは遅延評価し、索引は補正後の表示区間から構築する。
 */
export function createPreviewNoteMotion() {
  /** 子コンポーネントが登録した取得関数。有効化または再構築のときだけ評価する。 */
  const sources = new Set<Source>()

  // 設定や登録元が変わったときだけ、次の更新で座標と可視区間を作り直す。
  let config: MotionConfig | undefined
  let dirty = true
  let tree: IntervalTree | undefined
  let entries: Entry[] = []

  /** 変更したスタイルとSVG属性を、解除前の表示へ戻すための処理。 */
  let restore: (() => void)[] = []

  // 可視対象の配列を交互に再利用し、フレームごとの配列生成を避ける。
  let previous: Entry[] = []
  let visible: Entry[] = []

  // 同じ対象が複数区間から見つかった場合は、世代番号で二重更新を防ぐ。
  let generation = 0
  let currentPosition = NaN
  let lastPosition = NaN

  /** 指定プロパティのインライン指定と!importantを、復元処理として保存する。 */
  function saveStyle(element: HTMLElement | SVGElement, properties: string[]) {
    for (const property of properties) {
      const value = element.style.getPropertyValue(property)
      const priority = element.style.getPropertyPriority(property)

      restore.push(() => {
        if (value) {
          element.style.setProperty(property, value, priority)
        } else {
          element.style.removeProperty(property)
        }
      })
    }
  }

  /** SVG属性を保存する。元の属性が存在しなければ、復元時には属性自体を除去する。 */
  function saveAttribute(element: Element, attribute: string) {
    const value = element.getAttribute(attribute)

    restore.push(() => {
      if (value === null) {
        element.removeAttribute(attribute)
      } else {
        element.setAttribute(attribute, value)
      }
    })
  }

  /** 描画時の変更を復元し、現在のキャッシュと可視状態を破棄する。 */
  function clear() {
    restore.forEach(reset => reset())

    // 元の座標へ戻す際にCSS補間が始まると、解除後もノーツが動いて見える。
    // 可視要素の位置とパスの補間だけを終了し、色などのアニメーションは維持する。
    for (const entry of previous) {
      entry.element.getAnimations?.({ subtree: true }).forEach(animation => {
        const property = (animation as CSSTransition).transitionProperty

        if (property === 'transform' || property === 'd' || property === 'visibility') {
          animation.cancel()
        }
      })
    }

    restore = []
    entries = []
    previous = []
    visible = []
    tree = undefined
    lastPosition = NaN
  }

  /** 最新の要素と設定から、補正方法と可視区間の索引をまとめて再構築する。 */
  function rebuild() {
    clear()
    dirty = false

    const { beatHeight, bpm, viewportHeight, lift, drawOffset } = config!
    const orbitScale = getOrbitScale(beatHeight, bpm)
    const lower = -lift + drawOffset - VIEWPORT_MARGIN
    const upper = viewportHeight - lift + drawOffset + VIEWPORT_MARGIN
    const intervals: IndexedInterval[] = []

    /** 描画対象を一旦隠し、画面内に現れる各区間へ同じ対象を登録する。 */
    function add(
      element: Entry['element'],
      ranges: (Interval | undefined)[],
      draw: Entry['draw'],
    ) {
      saveStyle(element, ['visibility', 'transition'])

      const entry: Entry = {
        element,
        draw,
        seen: 0,
        visibility: element.style.getPropertyValue('visibility'),
        priority: element.style.getPropertyPriority('visibility'),
        visible: false,
      }

      element.style.transition = 'none'
      element.style.visibility = 'hidden'
      entries.push(entry)

      ranges.forEach(range => {
        if (range) {
          intervals.push({ range, entry })
        }
      })
    }

    for (const source of sources) {
      const { nodes = [], segments = [] } = source()

      // 単独のノーツと端点は、既存の位置へtransformを足すだけで補正できる。
      // 等速直進の対象は登録せず、譜面全体の移動にそのまま任せる。
      for (const { element, point, texture } of nodes) {
        if (!valid(point) || !changed(point)) {
          continue
        }

        saveStyle(element, ['transform'])

        let length = 0

        if (texture && Number.isFinite(texture.height)) {
          // 画像の下面を判定位置へ合わせたまま拡縮する。負のspeedでは画像も反転する。
          length = texture.height * point.speed
          saveStyle(texture.element, ['transform', 'transform-origin', 'transition'])

          texture.element.style.transition = 'none'
          texture.element.style.transformOrigin = 'center bottom'
          texture.element.style.transform = `scaleY(${point.speed})`
        }

        const range = band(point, lower - Math.max(0, length), upper - Math.min(0, length))

        add(element, [range], position => {
          const { x, y } = getMotionOffset(point, position, orbitScale)

          element.style.transform = `translate3d(${x}px, ${y}px, 0)`
        })
      }

      // ロングの帯は端点ごとの補正を使う。両端の速度と軌道が等しい場合だけ、形を固定できる。
      for (const { element, start, end, curve, height } of segments) {
        if (!valid(start) || !valid(end) || (!changed(start) && !changed(end))) {
          continue
        }

        const paths = Array.from(element.querySelectorAll('path'))

        if (paths.length !== 3 || !Number.isFinite(height)) {
          continue
        }

        paths.forEach(path => {
          saveAttribute(path, 'd')
          saveStyle(path, ['transition'])
          path.style.transition = 'none'
        })

        saveAttribute(element, 'transform')

        /** 補正した両端の座標から、曲線と幅を保って帯の三つのパスを更新する。 */
        const drawPaths = (position: number) => {
          const first = getMotionOffset(start, position, orbitScale)
          const last = getMotionOffset(end, position, orbitScale)

          const generated = generateHoldSvgPaths(
            start.left + first.x,
            height - start.bottom + first.y,
            end.left + last.x,
            height - end.bottom + last.y,
            curve,
            start.width,
            end.width,
          )

          paths[0].setAttribute('d', generated.fillPath)
          paths[1].setAttribute('d', generated.leftBorderPath)
          paths[2].setAttribute('d', generated.rightBorderPath)
        }

        const sameMotion = start.speed === end.speed && start.orbit === end.orbit

        if (sameMotion) {
          drawPaths(0)
        }

        // 始点が上・終点が下の場合と、その逆の場合を合わせると、帯全体の可視区間になる。
        // これにより、端点がどちらも画面外にあっても、画面を横切る帯を見落とさない。
        const ranges = [
          intersection(band(start, lower, Infinity), band(end, -Infinity, upper)),
          intersection(band(end, lower, Infinity), band(start, -Infinity, upper)),
        ]

        // 同じ動きの帯は位置0の形を事前計算し、フレーム中はSVGグループだけを平行移動する。
        // 両端の速度や軌道が異なる帯だけ、上で定義したパスの更新処理を使う。
        if (sameMotion) {
          add(element, ranges, position => {
            const x = -orbitScale * start.orbit * position
            const y = (start.speed - 1) * position

            element.setAttribute('transform', `translate(${x} ${y})`)
          })
        } else {
          add(element, ranges, drawPaths)
        }
      }
    }

    intervals.sort((a, b) => a.range[0] - b.range[0])
    tree = buildTree(intervals)
  }

  /** 今フレームの可視対象を一度だけ描画し、次のフレームに渡す配列へ記録する。 */
  function visit(entry: Entry) {
    if (entry.seen === generation) {
      return
    }

    entry.seen = generation

    if (!entry.visible) {
      if (entry.visibility) {
        entry.element.style.setProperty('visibility', entry.visibility, entry.priority)
      } else {
        entry.element.style.removeProperty('visibility')
      }

      entry.visible = true
    }

    entry.draw(currentPosition)
    visible.push(entry)
  }

  return {
    /** 取得関数を登録し、その登録を解除する関数を返す。キャッシュの生成は次回更新まで待つ。 */
    register(source: Source) {
      sources.add(source)
      dirty = true

      return () => {
        sources.delete(source)
        dirty = true
      }
    },

    /** 設定を保持し、換算率や表示範囲に変更がある場合だけ再構築を予約する。 */
    configure(next: MotionConfig) {
      if (
        !config ||
        (Object.keys(next) as (keyof MotionConfig)[]).some(key => next[key] !== config![key])
      ) {
        dirty = true
      }

      config = next
    },

    /**
     * 現在位置で可視対象だけを更新する。STOPなどで位置が同じなら描き直さない。
     * 呼び出し元は再生中かつ個別描画がONのときだけ、この関数を呼ぶ。
     *
     * @param position 判定ラインに対応する、譜面全体の現在の縦位置（px）。
     * @returns 今回更新した可視対象数。設定がない場合や更新不要の場合は0。
     */
    update(position: number) {
      if (!config || !Number.isFinite(position)) {
        return 0
      }

      if (dirty) {
        rebuild()
      } else if (position === lastPosition) {
        return 0
      }

      currentPosition = position
      lastPosition = position
      generation++

      query(tree, position, visit)

      // 前フレームで見えていた対象だけを調べ、今回範囲外へ出たものを隠す。
      for (const entry of previous) {
        if (entry.seen !== generation) {
          entry.element.style.visibility = 'hidden'
          entry.visible = false
        }
      }

      // 可視対象の配列を入れ替える。全対象の走査や、新しい配列の確保は行わない。
      const count = visible.length
      const spare = previous
      previous = visible
      visible = spare
      visible.length = 0

      return count
    },

    /** 全補正を解除して設定を破棄する。コンポーネントによる取得関数の登録は維持する。 */
    reset() {
      clear()
      config = undefined
      dirty = true
    },

    /** 現在キャッシュしている描画対象数。可視対象数とは別に、計測や検証で使用する。 */
    get targetCount() {
      return entries.length
    },
  }
}
