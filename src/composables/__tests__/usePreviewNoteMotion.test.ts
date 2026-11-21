import { describe, expect, it, vi } from 'vitest'
import type { NoteData } from 'chart-types'
import {
  createPreviewNoteMotion,
  getMotionOffset,
  getNoteMotion,
  getOrbitScale,
  type MotionConfig,
  type MotionPoint,
} from '../usePreviewNoteMotion'
import { getPreviewPosition } from '../usePreviewPlayback'
import type { Measure } from '../../types'

/** 計算結果を比較しやすい、1拍100px・BPM120・表示高400pxの基準設定。 */
const config: MotionConfig = {
  beatHeight: 100,
  bpm: 120,
  viewportHeight: 400,
  lift: 0,
  drawOffset: 0,
}

/** テストで必要な座標や倍率だけを上書きした描画端点を作る。 */
function point(overrides: Partial<MotionPoint> = {}): MotionPoint {
  return {
    bottom: 400,
    left: 100,
    width: 38,
    speed: 2,
    orbit: 1,
    ...overrides,
  }
}

/** オプションの読み取りに必要な項目だけを持つノーツを作る。 */
function note(type: number, option: string[] = []) {
  return { type, option } as NoteData
}

/** 復元後と比較できる静的なパスを持つ、ロングの帯のSVGグループを作る。 */
function segment() {
  const element = document.createElementNS('http://www.w3.org/2000/svg', 'g')

  for (let i = 0; i < 3; i++) {
    const path = document.createElementNS(element.namespaceURI, 'path')
    path.setAttribute('d', `M ${i} 0 L ${i} 100`)
    element.append(path)
  }

  return element
}

describe('本体から換算したspeed・orbit', () => {
  it.each([
    [1, ['2', '-1']],
    [2, ['2', '-1']],
    [89, ['2', '-1']],
    [3, ['3', '0', '1', '2', '-1']],
    [4, ['3', '0', '1', '2', '-1']],
    [6, ['3', '0', '1', '2', '-1']],
    [7, ['3', '0', '1', '2', '-1']],
    [94, ['image', '1', '1', '0', '1', '2', '-1']],
    [95, ['1', '2', '-1']],
    [90, ['3', '3', '0', '1', '2', '-1']],
  ] as [number, string[]][])('type %iのオプション位置を読み取る', (type, option) => {
    expect(getNoteMotion(note(type, option))).toEqual({ speed: 2, orbit: -1 })
  })

  it('音札はspeedのみを読み、制御イベントは対象にしない', () => {
    expect(getNoteMotion(note(5, ['2', '4']))).toEqual({ speed: 2, orbit: 0 })

    for (const type of [91, 92, 93, 96, 97, 98, 99, 100]) {
      expect(getNoteMotion(note(type))).toBeNull()
    }
  })

  it.each(['', ' ', 'abc', 'NaN', 'Infinity'])('不正な%sを既定値に置換する', value => {
    expect(getNoteMotion(note(1, [value, value]))).toEqual({ speed: 1, orbit: 0 })
  })

  it('未指定値は継承せず、端点の0以下だけを1倍へ戻す', () => {
    expect(getNoteMotion(note(1))).toEqual({ speed: 1, orbit: 0 })

    for (const speed of ['0', '-1']) {
      expect(getNoteMotion(note(1, [speed, '-2']))).toEqual({ speed: Number(speed), orbit: -2 })
      expect(getNoteMotion(note(89, [speed, '-2']), true)).toEqual({ speed: 1, orbit: -2 })
    }
  })

  it('初期BPM120の4拍先は本体2.083333単位=62.5pxの横移動となる', () => {
    expect(getMotionOffset(point(), 0, getOrbitScale(100, 120))).toEqual({ x: 62.5, y: -400 })
    expect(getMotionOffset(point({ bottom: 800 }), 0, getOrbitScale(200, 120))).toEqual({ x: 62.5, y: -800 })
    expect(getMotionOffset(point(), 0, getOrbitScale(100, 240)).x).toBe(31.25)
    expect(getMotionOffset(point(), 400, getOrbitScale(100, 120))).toEqual({ x: 0, y: -0 })
  })

  it.each([0, -1, Infinity, NaN])('不正な表示倍率%sでも有限値を返す', height => {
    expect(getMotionOffset(point(), 0, getOrbitScale(height, 120))).toEqual({ x: 0, y: -400 })
  })
})

describe('可視対象の索引と復元', () => {
  it('OFF中は登録元を評価せず、有効化後も等速直進は個別制御しない', () => {
    const renderer = createPreviewNoteMotion()
    const element = document.createElement('span')
    const source = vi.fn(() => ({ nodes: [{ element, point: point({ speed: 1, orbit: 0 }) }] }))

    renderer.register(source)

    expect(renderer.update(0)).toBe(0)
    expect(source).not.toHaveBeenCalled()

    renderer.configure(config)

    expect(renderer.update(0)).toBe(0)
    expect(element.getAttribute('style')).toBeNull()

    renderer.reset()

    expect(renderer.update(100)).toBe(0)
    expect(source).toHaveBeenCalledOnce()
  })

  it('元の位置が遠い低速ノーツと、逆走・静止ノーツを補正後の高さで判定する', () => {
    const renderer = createPreviewNoteMotion()
    const nodes = [
      { element: document.createElement('span'), point: point({ bottom: 4000, speed: 0.1 }) },
      { element: document.createElement('span'), point: point({ bottom: -200, speed: -1 }) },
      { element: document.createElement('span'), point: point({ bottom: 100000, speed: 0 }) },
    ]

    renderer.register(() => ({ nodes }))
    renderer.configure(config)

    expect(renderer.update(0)).toBe(3)
    expect(nodes[0].element.style.transform).toBe('translate3d(625px, 3600px, 0)')
    expect(renderer.update(1000)).toBe(2)
    expect(nodes[1].element.style.visibility).toBe('hidden')

    // 以前の位置へ戻った場合にも、索引から同じ可視対象を取得できる。
    expect(renderer.update(0)).toBe(3)
    expect(nodes[1].element.style.visibility).toBe('')
  })

  it('同じ描画位置では書き直さず、viewport・LIFT・描画オフセットに追従する', () => {
    const renderer = createPreviewNoteMotion()
    const element = document.createElement('span')

    renderer.register(() => ({ nodes: [{ element, point: point() }] }))
    renderer.configure(config)

    expect(renderer.update(0)).toBe(0)

    renderer.configure({ ...config, viewportHeight: 1000 })

    expect(renderer.update(0)).toBe(1)
    expect(renderer.update(0)).toBe(0)

    renderer.configure({ ...config, viewportHeight: 1000, lift: 500 })

    expect(renderer.update(0)).toBe(0)

    renderer.configure({ ...config, viewportHeight: 1000, lift: 500, drawOffset: 500 })

    expect(renderer.update(0)).toBe(1)
  })

  it.each([0, -2, 2])('画像の下面を基準にspeed=%sを反映し、表示高さまで索引に含める', speed => {
    const renderer = createPreviewNoteMotion()
    const element = document.createElement('span')
    const image = document.createElement('img')

    image.style.transform = 'translateX(1px)'

    renderer.register(() => ({
      nodes: [{
        element,
        point: point({ bottom: -1000, speed, orbit: 0 }),
        texture: { element: image, height: 2000 },
      }],
    }))
    renderer.configure(config)

    expect(renderer.update(0)).toBe(1)
    expect(image.style.transform).toBe(`scaleY(${speed})`)
    expect(image.style.transformOrigin).toBe('center bottom')

    renderer.reset()

    expect(image.style.transform).toBe('translateX(1px)')
    expect(image.style.transformOrigin).toBe('')
  })

  it('両端が画面外でも帯が横切る区間を更新し、独立速度とorbitで上下逆転を描く', () => {
    const renderer = createPreviewNoteMotion()
    const element = segment()

    renderer.register(() => ({
      segments: [{
        element,
        start: point({ bottom: -100, speed: 2 }),
        end: point({ bottom: 1000, speed: 0.5 }),
        curve: 'ease',
        height: 2000,
      }],
    }))
    renderer.configure(config)

    expect(renderer.update(0)).toBe(1)
    expect(element.children[0].getAttribute('d')).toContain('C ')

    renderer.reset()

    // 速度差で始点と終点の上下が逆になっても、帯は補正後の両端を結ぶ。
    const inverted = segment()

    renderer.register(() => ({
      segments: [{
        element: inverted,
        start: point({ bottom: 100, speed: 2 }),
        end: point({ bottom: 300, left: 200, speed: 0.5, orbit: -1 }),
        curve: 'linear',
        height: 1000,
      }],
    }))
    renderer.configure({ ...config, viewportHeight: 1000 })

    expect(renderer.update(50)).toBe(2)
    expect(inverted.children[0].getAttribute('d')).toBe('M 88.8125 850 L 126.8125 850 L 179.9375 825 L 141.9375 825 Z')
  })

  it('BPM変化・STOP・WARP・offsetも既存の描画距離に同期する', () => {
    const measures: Measure[] = [
      {
        measure: 0,
        measureBeat: 4,
        measureBpm: 120,
        measureLength: 2000,
        measureHeight: 400,
        measurePositionBottom: 0,
        measureReachTime: 0,
      },
      {
        measure: 1,
        measureBeat: 2,
        measureBpm: 120,
        measureLength: 1000,
        measureHeight: 0,
        measurePositionBottom: 400,
        measureReachTime: 2000,
      },
      {
        measure: 2,
        measureBeat: 2,
        measureBpm: 120,
        measureLength: 0,
        measureHeight: 200,
        measurePositionBottom: 400,
        measureReachTime: 3000,
      },
      {
        measure: 3,
        measureBeat: 4,
        measureBpm: 60,
        measureLength: 4000,
        measureHeight: 400,
        measurePositionBottom: 600,
        measureReachTime: 3000,
      },
    ]

    const renderer = createPreviewNoteMotion()
    const element = document.createElement('span')
    let bottom = 800

    renderer.register(() => ({ nodes: [{ element, point: point({ bottom, speed: 0.5 }) }] }))
    renderer.configure(config)
    renderer.update(getPreviewPosition(measures, 2500))
    expect(element.style.transform).toBe('translate3d(62.5px, 200px, 0)')
    expect(renderer.update(getPreviewPosition(measures, 2999))).toBe(0)
    renderer.update(getPreviewPosition(measures, 3000))
    expect(element.style.transform).toBe('translate3d(31.25px, 100px, 0)')
    renderer.update(getPreviewPosition(measures, 4000))
    expect(element.style.transform).toBe('translate3d(15.625px, 50px, 0)')

    renderer.reset()

    // offsetに合わせてノーツと小節の基準を同じだけ動かすと、相対位置は変わらない。
    bottom += 40
    renderer.configure(config)

    const shifted = measures.map(measure => ({
      ...measure,
      measureReachTime: measure.measureReachTime + 200,
      measurePositionBottom: measure.measurePositionBottom + 40,
    }))

    renderer.update(getPreviewPosition(shifted, 4200))
    expect(element.style.transform).toBe('translate3d(15.625px, 50px, 0)')
  })

  it('共通速度の帯はパスを再生成せず平行移動し、解除時に全属性を戻す', () => {
    const renderer = createPreviewNoteMotion()
    const element = segment()
    const initial = element.outerHTML

    renderer.register(() => ({
      segments: [{
        element,
        start: point({ bottom: 100 }),
        end: point({ bottom: 300 }),
        curve: 'easeOut',
        height: 1000,
      }],
    }))
    renderer.configure({ ...config, viewportHeight: 1000 })
    renderer.update(0)

    const write = vi.spyOn(element.children[0], 'setAttribute')

    renderer.update(50)

    expect(element.getAttribute('transform')).toBe('translate(-7.8125 50)')
    expect(write).not.toHaveBeenCalled()

    renderer.reset()

    // CSSStyleDeclarationは空のstyle属性を残すが、表示上の属性はすべて元に戻る。
    for (const child of [element, ...element.children]) {
      if (child.getAttribute('style') === '') {
        child.removeAttribute('style')
      }
    }

    expect(element.outerHTML).toBe(initial)
  })

  it('登録解除・再構築で元のインライン指定と!importantを保持する', () => {
    const renderer = createPreviewNoteMotion()
    const element = document.createElement('span')

    element.style.setProperty('visibility', 'collapse', 'important')
    element.style.transform = 'translateX(1px)'
    element.style.transition = 'color 1s'
    const unregister = renderer.register(() => ({ nodes: [{ element, point: point({ bottom: 100 }) }] }))
    renderer.configure(config)
    renderer.update(0)
    unregister()
    renderer.update(0)
    expect(element.style.transform).toBe('translateX(1px)')
    expect(element.style.visibility).toBe('collapse')
    expect(element.style.getPropertyPriority('visibility')).toBe('important')
    expect(element.style.transition).toBe('color 1s')
  })

  it('解除時の位置・パス補間を終了し、他のアニメーションは維持する', () => {
    const renderer = createPreviewNoteMotion()
    const element = document.createElement('span')
    const movement = { transitionProperty: 'transform', cancel: vi.fn() }
    const color = { transitionProperty: 'color', cancel: vi.fn() }
    const getAnimations = vi.fn(() => [movement, color])

    Object.assign(element, { getAnimations })
    renderer.register(() => ({ nodes: [{ element, point: point({ bottom: 100 }) }] }))
    renderer.configure(config)
    renderer.update(0)
    renderer.update(1)
    expect(getAnimations).not.toHaveBeenCalled()

    renderer.reset()

    expect(movement.cancel).toHaveBeenCalledOnce()
    expect(color.cancel).not.toHaveBeenCalled()
  })

  it('1万ノーツと200ロングでも毎フレームの更新数を画面内対象に絞る', () => {
    const renderer = createPreviewNoteMotion()
    const nodes = Array.from({ length: 10000 }, (_, i) => ({
      element: document.createElement('span'), point: point({ bottom: i * 100, speed: 0.5 + i % 3, orbit: i % 2 }),
    }))
    const segments = Array.from({ length: 200 }, (_, i) => ({
      element: segment(), start: point({ bottom: i * 4000 }), end: point({ bottom: i * 4000 + 1000 }),
      curve: 'linear' as const, height: 1000000,
    }))
    const source = vi.fn(() => ({ nodes, segments }))

    renderer.register(source)
    renderer.configure(config)

    for (const position of [0, 10000, 500000, 100000, -500]) {
      expect(renderer.update(position)).toBeLessThan(25)
    }

    expect(source).toHaveBeenCalledOnce()
    expect(renderer.targetCount).toBe(10200)

    renderer.reset()
  })
})
