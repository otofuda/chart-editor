import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, shallowRef, watch } from 'vue'
import type { LocationStrategyFunction } from 'vuetify'
import { useNoteMenuLocation } from '../useNoteMenuLocation'

/** 要素ごとのサイズ変更通知を、テストから任意のタイミングで発生させる。 */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  elements = new Set<Element>()

  /** サイズ変更時に呼び出す処理を保持し、生成した監視を一覧へ登録する。 */
  constructor(private callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this)
  }

  /** サイズ変更の通知対象へ要素を追加する。 */
  observe(element: Element) {
    this.elements.add(element)
  }

  /** この監視に登録されたすべての要素を解除する。 */
  disconnect() {
    this.elements.clear()
  }

  /** 指定した要素を監視している処理へサイズ変更を通知する。 */
  static resize(element: Element) {
    for (const observer of this.instances) {
      if (observer.elements.has(element)) {
        observer.callback([], observer as unknown as ResizeObserver)
      }
    }
  }
}

let cleanup: (() => void) | undefined

beforeEach(() => {
  FakeResizeObserver.instances = []
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.stubGlobal('innerHeight', 900)
})

afterEach(() => {
  cleanup?.()
  cleanup = undefined
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/**
 * 譜面・クリック対象・フォームの矩形と、配置戦略の切り替えを再現する。
 * 第2引数で各要素の位置や大きさを指定できる。
 *
 * @param maxWidth - 編集メニューの最大幅（px）。
 * @returns 配置状態、検証用の要素、変更可能な矩形情報、クリック操作。
 */
function setup(
  maxWidth = 240,
  {
    chartLeft = 1000,
    top = 300,
    left = 1060,
    width = 60,
    height = 200,
  } = {},
) {
  const preview = document.createElement('div')
  preview.className = 'preview'

  const target = document.createElement('span')
  preview.append(target)

  const content = document.createElement('div')
  document.body.append(preview, content)

  const geometry = { chartLeft, top, left, width, height }

  vi.spyOn(preview, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(geometry.chartLeft, 0, 420, 3000),
  )
  vi.spyOn(target, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(geometry.left, geometry.top, geometry.width, 4),
  )
  Object.defineProperty(content, 'offsetHeight', {
    get: () => geometry.height,
  })

  const scope = effectScope()
  const state = scope.run(() => {
    const menu = ref(false)
    const location = useNoteMenuLocation(menu, maxWidth)
    const styles = ref<Record<string, string>>({})
    let strategyScope: ReturnType<typeof effectScope> | undefined
    let updateLocation = () => {}

    watch(
      [menu, location.locationStrategy],
      ([isOpen, strategy], _, onCleanup) => {
        if (!isOpen || typeof strategy !== 'function') return

        strategyScope = effectScope()

        const args: Parameters<LocationStrategyFunction> = [
          {
            contentEl: shallowRef(content),
            target: shallowRef(target),
            isActive: menu,
            isRtl: ref(false),
          },
          {
            locationStrategy: strategy,
            location: 'bottom',
            origin: 'auto',
            maxWidth,
          },
          styles,
        ]
        const result = strategyScope.run(() => strategy(...args))

        updateLocation = result?.updateLocation ?? (() => {})
        onCleanup(() => strategyScope?.stop())
      },
      { flush: 'post' },
    )

    return {
      menu,
      ...location,
      styles,
      update: () => updateLocation(),
    }
  })!

  target.addEventListener('click', state.openMenu)
  cleanup = () => scope.stop()

  /**
   * 対象要素を指定した高さでクリックし、配置の更新を待つ。
   *
   * @param clientY - ビューポート内でのクリック位置（px）。
   */
  async function click(clientY = geometry.top) {
    target.dispatchEvent(new MouseEvent('click', { detail: 1, clientY }))
    await nextTick()
  }

  return {
    ...state,
    preview,
    target,
    content,
    geometry,
    click,
    scope,
  }
}

describe('譜面の左外側に編集メニューを配置する', () => {
  it.each([
    [240, 1060, 60],
    [240, 1300, 60],
    [240, 1000, 300],
    [240, 900, 480],
    [420, 1060, 60],
    [420, 1300, 60],
  ])('最大幅%i・ノーツ左端%i・ノーツ幅%iでも譜面に重ならない', async (maxWidth, left, width) => {
    const state = setup(maxWidth, { left, width })
    await state.click()
    expect(state.styles.value).toMatchObject({
      position: 'fixed',
      left: `${1000 - 12 - maxWidth}px`,
      width: `${maxWidth}px`,
      top: '300px',
    })
    expect(parseFloat(state.styles.value.left) + maxWidth).toBe(1000 - 12)
  })

  it.each([
    [-100, 200, 12],
    [880, 200, 688],
    [700, 1500, 12],
  ])('クリック位置%i・高さ%iのフォームを上下の余白内に収める', async (top, height, expectedTop) => {
    const state = setup(420, { top, height })
    await state.click()
    expect(state.styles.value.top).toBe(`${expectedTop}px`)
    expect(state.styles.value.maxHeight).toBe('876px')
  })

  it('帯の途中をクリックした位置に表示し、同じ帯をクリックし直しても縦位置を更新する', async () => {
    const state = setup(420, { top: 100 })
    await state.click(450)
    expect(state.styles.value.top).toBe('450px')
    await state.click(600)
    expect(state.styles.value.top).toBe('600px')
  })

  it('スクロール時にクリック箇所を追従し、ウィンドウを譜面の外側に保つ', async () => {
    const state = setup(420, { top: 100 })
    await state.click(450)
    state.geometry.top = -100
    state.update() // Vuetifyのrepositionスクロール戦略から呼ばれる
    expect(state.styles.value.top).toBe('250px')
    expect(state.styles.value.left).toBe('568px')
  })

  it('終点の追加でフォームが高くなった場合も画面内へ再配置する', async () => {
    const state = setup(420, { top: 600 })
    await state.click()
    state.geometry.height = 800
    FakeResizeObserver.resize(state.content)
    expect(state.styles.value.top).toBe('88px')
    expect(state.styles.value.maxHeight).toBe('876px')
  })

  it('画面の縮小で標準配置へ切り替え、拡大すると外側の配置へ戻る', async () => {
    const state = setup(420)
    await state.click()
    state.geometry.chartLeft = 400
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(state.locationStrategy.value).toBe('connected')
    expect(state.styles.value).toEqual({})
    state.geometry.chartLeft = 800
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(typeof state.locationStrategy.value).toBe('function')
    expect(state.styles.value.left).toBe('368px')
  })

  it.each([
    [240, 263, false],
    [240, 264, true],
    [420, 443, false],
    [420, 444, true],
  ])(
    '最大幅%i・左側の余白%iでは外側表示を%sにする',
    async (maxWidth, chartLeft, outside) => {
      const state = setup(maxWidth, { chartLeft })
      await state.click()
      expect(typeof state.locationStrategy.value === 'function').toBe(outside)
    },
  )

  it('譜面のサイズ変更でも標準配置から外側表示へ切り替わる', async () => {
    const state = setup(420, { chartLeft: 400 })
    await state.click()
    state.geometry.chartLeft = 800
    FakeResizeObserver.resize(state.preview)
    await nextTick()
    expect(state.styles.value.left).toBe('368px')
  })

  it('キーボードで開く場合は対象要素の上端を基準にする', async () => {
    const state = setup()
    state.target.addEventListener('keydown', state.rememberMenuTarget)
    state.target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    state.menu.value = true
    await nextTick()
    expect(state.styles.value.top).toBe('300px')
  })

  it('譜面外の要素では標準配置を使う', async () => {
    const state = setup()
    state.preview.className = ''
    await state.click()
    expect(state.locationStrategy.value).toBe('connected')
  })

  it('閉じた後はobserverを解除し、閉じるアニメーション中の位置を保つ', async () => {
    const state = setup()
    await state.click()
    const styles = { ...state.styles.value }
    state.menu.value = false
    await nextTick()
    expect(FakeResizeObserver.instances.every(observer => observer.elements.size === 0)).toBe(true)
    expect(state.styles.value).toEqual(styles)
    state.update()
    expect(state.styles.value).toEqual(styles)
  })
})
