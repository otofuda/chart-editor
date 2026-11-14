import {
  computed,
  nextTick,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
  type Ref,
} from 'vue'
import type { LocationStrategyFunction } from 'vuetify'

/** 譜面との間隔と、画面の上下左右に確保する余白（px）。 */
const margin = 12

/**
 * ノーツの編集メニューを譜面の左外側に配置する。
 * 左側に十分な余白がない場合は、Vuetifyの標準配置へ切り替える。
 *
 * @param menu - 編集メニューの開閉状態。
 * @param maxWidth - 編集メニューに確保する最大幅（px）。
 * @returns 配置対象、配置戦略、クリック位置の記録処理、メニューを開く処理。
 */
export function useNoteMenuLocation(menu: Ref<boolean>, maxWidth: number) {
  const menuTarget = shallowRef<Element>()
  const previewLeft = ref<number>()
  const clickOffsetY = ref(0)

  /** 表示対象が属する譜面の左端を実測し、配置方式の判定に反映する。 */
  function updatePreviewLeft() {
    previewLeft.value = menuTarget.value
      ?.closest('.preview')
      ?.getBoundingClientRect().left
  }

  /**
   * 操作した要素と、その要素内のクリック位置を記録する。
   * SVGの帯はクリックした高さ、キーボード操作は要素の上端を基準にする。
   *
   * @param event - ノーツやロングの帯で発生したクリックまたはキー操作。
   */
  function rememberMenuTarget(event: MouseEvent | KeyboardEvent) {
    if (!(event.currentTarget instanceof Element)) return

    menuTarget.value = event.currentTarget
    clickOffsetY.value = event instanceof MouseEvent && event.detail > 0
      ? event.clientY - event.currentTarget.getBoundingClientRect().top
      : 0

    updatePreviewLeft()
  }

  /**
   * ロングの中点・終点・帯を配置の基準にして編集メニューを開く。
   *
   * @param event - 編集メニューを開くクリック操作。
   */
  function openMenu(event: MouseEvent) {
    rememberMenuTarget(event)
    menu.value = true
  }

  // 標準配置から外側の配置へ戻す場合にも、画面幅の変化を検知する。
  watch(
    [menu, menuTarget],
    ([isOpen, target], _, onCleanup) => {
      const preview = target?.closest('.preview')
      if (!isOpen || !preview) return

      updatePreviewLeft()

      const observer = typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(updatePreviewLeft)

      observer?.observe(preview)
      window.addEventListener('resize', updatePreviewLeft)

      onCleanup(() => {
        observer?.disconnect()
        window.removeEventListener('resize', updatePreviewLeft)
      })
    },
    { flush: 'post' },
  )

  /**
   * Vuetifyの配置処理に、譜面の左外側を基準にする戦略を提供する。
   *
   * @param data - 表示状態とメニュー要素を含むVuetifyの配置情報。
   * @param _ - Vuetifyの配置設定。この戦略では共通の余白と最大幅を使用する。
   * @param contentStyles - メニュー本体へ適用する配置スタイル。
   * @returns Vuetifyがスクロールやリサイズ時に呼び出す再配置処理。
   */
  const outsideLocation: LocationStrategyFunction = (data, _, contentStyles) => {
    let disposed = false

    /** クリック位置を追従し、メニューを画面の上下の余白内に収める。 */
    function updateLocation() {
      if (disposed) return

      const target = menuTarget.value
      const content = data.contentEl.value
      const preview = target?.closest('.preview')
      if (!target || !content || !preview) return

      updatePreviewLeft()

      const viewportHeight = document.documentElement.clientHeight
        || window.innerHeight
      const maxHeight = Math.max(0, viewportHeight - margin * 2)
      const height = Math.min(content.offsetHeight, maxHeight)
      const clickY = target.getBoundingClientRect().top + clickOffsetY.value
      const top = Math.max(
        margin,
        Math.min(clickY, viewportHeight - margin - height),
      )

      contentStyles.value = {
        position: 'fixed',
        left: `${previewLeft.value - margin - maxWidth}px`,
        top: `${top}px`,
        width: `${maxWidth}px`,
        maxHeight: `${maxHeight}px`,
        transformOrigin: 'right top',
        '--v-overlay-anchor-origin': 'right top',
      }
    }

    const observer = typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(updateLocation)

    watch(
      [data.contentEl, menuTarget, clickOffsetY],
      ([content, target], _, onCleanup) => {
        if (content) observer?.observe(content)
        if (target) observer?.observe(target)

        updateLocation()
        onCleanup(() => observer?.disconnect())
      },
      { immediate: true, flush: 'post' },
    )

    void nextTick(updateLocation)

    onScopeDispose(() => {
      disposed = true
      observer?.disconnect()

      // 標準配置への切り替え時だけ初期化し、閉じるアニメーション中の位置は保つ。
      if (data.isActive.value) contentStyles.value = {}
    })

    return { updateLocation }
  }

  /** メニュー幅と左右の余白を確保できる場合だけ、譜面外の配置を使う。 */
  const locationStrategy = computed(() =>
    previewLeft.value !== undefined && previewLeft.value >= maxWidth + margin * 2
      ? outsideLocation
      : 'connected',
  )

  return {
    menuTarget,
    locationStrategy,
    rememberMenuTarget,
    openMenu,
  }
}
