import {
  onBeforeUnmount,
  readonly,
  shallowRef,
  watch,
  type InjectionKey,
  type Ref,
} from 'vue'
import type { NoteData } from 'chart-types'
import type { ExtendedNoteData, Measure } from '@/types'
import type { ChartHistory } from './useChartHistory'
import { hasOpenEditorOverlay, isIgnoredKeyboardEvent } from './useEditorShortcuts'
import {
  calculateNoteMove,
  canDragNote,
  commitNoteMove,
  createNoteMoveSession,
  type NoteMoveCandidate,
  type NoteMoveSession,
} from './noteMovement'

/** 各ノーツの描画コンポーネントから利用するドラッグ操作の窓口。 */
export type NoteDrag = {
  /** 現在の表示モードでドラッグを開始できるか。 */
  enabled: Ref<boolean>
  /** 始点または指定した中点・終点からドラッグ操作を開始する。 */
  start: (event: PointerEvent, root: ExtendedNoteData, node?: NoteData) => void
  /** ロングの帯から、すべての点の位置関係を保ってドラッグを開始する。 */
  startWhole: (event: PointerEvent, root: ExtendedNoteData) => void
}

/** 譜面プレビューから子のノーツへドラッグ操作を提供するためのキー。 */
export const noteDragKey: InjectionKey<NoteDrag> = Symbol('noteDrag')

/**
 * ポインター操作、移動候補の表示、自動スクロール、確定・中断を管理する。
 *
 * @param options 譜面データ、表示要素、スナップ設定、通知処理
 * @returns 子ノーツへ提供する操作と、候補表示に使うリアクティブな状態
 */
export function useNoteDrag(options: {
  content: Ref<HTMLElement | null>
  /** 未指定時はページ全体をスクロールする。 */
  scrollContainer?: Ref<HTMLElement | null>
  chart: Ref<ExtendedNoteData[]>
  /** 配置欄と連動するシャドー。仮配置済みノーツは含めない。 */
  draft?: Ref<ExtendedNoteData | null>
  measures: Ref<Measure[]>
  enabled: Ref<boolean>
  /** 配置欄で指定されている split。 */
  split: Ref<number>
  /** 配置欄の値に代えて、掴んだノーツ自身の split を使うか。 */
  ownSplit: Ref<boolean>
  /** 難易度など、変更時にドラッグを中断すべき編集対象の識別子。 */
  context: Ref<string | undefined>
  showSnackbar: (message: string) => void
  history?: ChartHistory | null
}) {
  const candidate = shallowRef<NoteMoveCandidate | null>(null)
  /** ポインター押下から解除までを表し、移動開始前も別のキー操作を抑止する。 */
  const isActive = shallowRef(false)

  let pointer = { x: 0, y: 0 }
  let session: NoteMoveSession | null = null
  let pointerId: number | null = null
  let origin = { x: 0, bottom: 0 }
  let captureElement: HTMLElement | null = null
  let touchTarget: EventTarget | null = null
  let dragging = false
  let shiftPressed = false
  let frame = 0
  let previousFrame = 0
  let suppressTimer: ReturnType<typeof setTimeout> | undefined
  let suppressing = false

  /** ドラッグ直後のクリック抑止と、その解除に使うイベント・タイマーを取り除く。 */
  function removeClickSuppression() {
    document.removeEventListener('click', suppressClick, true)
    document.removeEventListener('pointerdown', removeClickSuppression, true)
    clearTimeout(suppressTimer)
    suppressing = false
  }

  /** ドラッグ終了後に譜面内で発生するクリックを消費し、編集メニューの誤表示を防ぐ。 */
  function suppressClick(event: MouseEvent) {
    if (options.content.value?.contains(event.target as Node)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      removeClickSuppression()
    }
  }

  /** 次のクリックを一時的に抑止し、新しいポインター操作が始まったら解除する。 */
  function suppressNextClick() {
    removeClickSuppression()
    suppressing = true
    document.addEventListener('click', suppressClick, true)
    document.addEventListener('pointerdown', removeClickSuppression, true)
    suppressTimer = setTimeout(removeClickSuppression, 500)
  }

  /** 元データを変更せずに候補、ポインター捕捉、イベント、自動スクロールを解除する。 */
  function cleanup() {
    const element = captureElement
    const id = pointerId

    session = null
    isActive.value = false
    pointerId = null
    captureElement = null
    touchTarget = null
    dragging = false
    shiftPressed = false
    candidate.value = null
    cancelAnimationFrame(frame)
    frame = 0
    previousFrame = 0
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', drop)
    window.removeEventListener('pointercancel', cancel)
    window.removeEventListener('keydown', handleKey, true)
    window.removeEventListener('keyup', handleKey, true)
    window.removeEventListener('blur', cancel)
    window.removeEventListener('scroll', update, true)
    document.removeEventListener('visibilitychange', visibilityChange)
    element?.removeEventListener('lostpointercapture', lostCapture)
    if (id !== null && element?.hasPointerCapture?.(id)) {
      element.releasePointerCapture(id)
    }
  }

  /** 操作中のポインターに対応する中断を受け付け、未確定の移動候補を破棄する。 */
  function cancel(event?: Event) {
    if (event && 'pointerId' in event && event.pointerId !== pointerId) {
      return
    }

    if (dragging) {
      suppressNextClick()
    }

    cleanup()
  }

  /** タブが非表示になった場合に、残っているドラッグ操作を中断する。 */
  function visibilityChange() {
    if (document.hidden) {
      cancel()
    }
  }

  /** 譜面自身のポインター捕捉が失われた場合だけ、操作を中断する。 */
  function lostCapture(event: PointerEvent) {
    // タッチの暗黙の捕捉をノーツから譜面へ移す際、元の要素からもこのイベントがバブルする。
    if (event.target === captureElement) {
      cancel(event)
    }
  }

  /**
   * Escで中断し、Shiftの押下・解除で吸着基準を即時に切り替える。
   *
   * @param event ドラッグ操作中に受け取ったキーの押下・解除イベント
   */
  function handleKey(event: KeyboardEvent) {
    if (event.type === 'keydown' && event.key === 'Escape') {
      // メニューを閉じるEscやIMEの操作を、ドラッグの中断で横取りしない。
      if (
        isIgnoredKeyboardEvent(event)
        || event.repeat
        || hasOpenEditorOverlay()
        || event.ctrlKey
        || event.metaKey
        || event.altKey
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      cancel()
    } else if (event.key === 'Shift' && shiftPressed !== event.shiftKey) {
      shiftPressed = event.shiftKey
      update()
    }
  }

  /**
   * ノーツから始まったタッチ操作では、最初の指の移動から標準スクロールを抑止する。
   * タップのクリックを維持するため touchstart は抑止せず、移動時だけ処理する。
   */
  function preventTouchScroll(event: TouchEvent) {
    if (session && event.target === touchTarget && event.cancelable) {
      event.preventDefault()
    }
  }

  /** スクロール後の譜面座標も含めて移動量を求め、しきい値を超えたら候補を更新する。 */
  function update() {
    if (!session || !options.content.value) {
      return
    }

    const bounds = options.content.value.getBoundingClientRect()
    const dx = pointer.x - bounds.left - origin.x
    const dy = bounds.bottom - pointer.y - origin.bottom
    if (!dragging && Math.hypot(dx, dy) < 5) {
      return
    }

    dragging = true
    session.split = options.ownSplit.value !== shiftPressed
      ? Number(session.anchorBefore.split)
      : options.split.value
    candidate.value = calculateNoteMove(
      session,
      dx,
      dy,
      Math.abs(dx) >= 4,
      Math.abs(dy) >= 4,
    )
  }

  /** 操作中のポインターだけを追跡し、移動開始後は捕捉と自動スクロールを有効にする。 */
  function move(event: PointerEvent) {
    if (event.pointerId !== pointerId) {
      return
    }

    pointer = { x: event.clientX, y: event.clientY }
    shiftPressed = event.shiftKey
    update()

    if (dragging) {
      if (!captureElement?.hasPointerCapture?.(event.pointerId)) {
        captureElement?.setPointerCapture?.(event.pointerId)
      }

      event.preventDefault()

      if (!frame) {
        frame = requestAnimationFrame(autoScroll)
      }
    }
  }

  /**
   * 譜面の表示領域の端に近いほど速くスクロールし、移動候補を再計算する。
   *
   * @param now アニメーションフレームが渡す時刻（ミリ秒）
   */
  function autoScroll(now: number) {
    frame = 0

    if (!dragging || !options.content.value) {
      return
    }

    const bounds = options.content.value.getBoundingClientRect()
    const elapsed = previousFrame ? Math.min(now - previousFrame, 40) : 16
    previousFrame = now
    const { x, y } = pointer

    const container = options.scrollContainer?.value
    const viewport = container?.getBoundingClientRect()
    const top = viewport?.top ?? 0
    const bottom = viewport?.bottom ?? window.innerHeight
    const left = viewport ? Math.max(viewport.left, bounds.left - 40) : bounds.left - 40
    const right = viewport ? Math.min(viewport.right, bounds.right + 40) : bounds.right + 40

    // 分割表示では、操作パネル上にポインターがある間はスクロールしない。
    if (x >= left && x <= right && (!container || (y >= top && y <= bottom))) {
      const edge = 56
      const speed = y < top + edge
        ? -Math.min(1, (top + edge - y) / edge)
        : y > bottom - edge
          ? Math.min(1, (y - bottom + edge) / edge)
          : 0

      if (speed) {
        const target = container ?? window
        target.scrollBy({ top: speed * elapsed * 0.8, behavior: 'instant' })
        update()
      }
    }

    frame = requestAnimationFrame(autoScroll)
  }

  /** ドロップ位置を再計算し、操作終了後に候補を確定するか、移動できない理由を通知する。 */
  function drop(event: PointerEvent) {
    if (event.pointerId !== pointerId) {
      return
    }

    pointer = { x: event.clientX, y: event.clientY }
    shiftPressed = event.shiftKey
    update()
    const final = candidate.value

    if (dragging) {
      suppressNextClick()
    }

    // データ更新の監視やDOMの再配置が、確定処理を中断しないよう先に終了する。
    cleanup()

    if (!final) {
      return
    }

    if (final.error) {
      options.showSnackbar(final.error)
    } else {
      if (options.history && final.source === 'chart') {
        options.history.run(
          { label: 'ノーツをドラッグ移動' },
          () => commitNoteMove(final)
        )
      } else {
        commitNoteMove(final)
      }
    }
  }

  /**
   * 編集可能なノーツ上の主ポインター操作を、ドラッグ開始候補として登録する。
   *
   * @param event ノーツ上で発生した pointerdown イベント
   * @param root 掴んだ点を所有する始点ノーツ
   * @param node 直接掴んだ点。省略時は始点自身
   * @param whole ロングの帯から全体を移動するか
   */
  function start(
    event: PointerEvent,
    root: ExtendedNoteData,
    node: NoteData = root,
    whole = false,
  ) {
    const source = root === options.draft?.value ? 'draft' : 'chart'

    if (
      !options.enabled.value ||
      !canDragNote(root, source) ||
      pointerId !== null ||
      event.isPrimary === false ||
      event.button !== 0
    ) {
      return
    }

    const target = event.target as Element

    if (target.closest('input, textarea, button, a, select, [contenteditable="true"]')) {
      return
    }

    const element = options.content.value

    if (!element) {
      return
    }

    const split = options.ownSplit.value !== event.shiftKey ? Number(node.split) : options.split.value
    session = createNoteMoveSession(
      options.chart.value,
      root,
      node,
      options.measures.value,
      split,
      whole,
      source,
    )

    if (!session) {
      return
    }

    if (suppressing) {
      removeClickSuppression()
    }

    const bounds = element.getBoundingClientRect()
    origin = {
      x: event.clientX - bounds.left,
      bottom: bounds.bottom - event.clientY,
    }
    pointer = { x: event.clientX, y: event.clientY }
    shiftPressed = event.shiftKey
    pointerId = event.pointerId
    isActive.value = true
    captureElement = element
    touchTarget = event.pointerType === 'touch' ? event.target : null

    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', drop)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', handleKey, true)
    window.addEventListener('keyup', handleKey, true)
    window.addEventListener('blur', cancel)
    window.addEventListener('scroll', update, true)
    document.addEventListener('visibilitychange', visibilityChange)
    element.addEventListener('lostpointercapture', lostCapture)
  }

  /** 帯を掴んだ場合は、チェック状態にかかわらずロング全体を移動対象にする。 */
  function startWhole(event: PointerEvent, root: ExtendedNoteData) {
    start(event, root, root, true)
  }

  // ジェスチャー開始前から非 passive のリスナーを登録し、最初の touchmove をキャンセル可能にする。
  watch(
    options.content,
    (element, previous) => {
      previous?.removeEventListener('touchmove', preventTouchScroll, true)
      element?.addEventListener('touchmove', preventTouchScroll, {
        capture: true,
        passive: false,
      })
    },
    { flush: 'sync' },
  )

  // 別の編集、譜面の切り替え、ズーム、再生開始時には、開始時の座標を破棄する。
  watch(
    [
      () => JSON.stringify(options.chart.value),
      () => options.draft?.value,
      () => JSON.stringify(options.draft?.value),
      () => JSON.stringify(options.measures.value),
      options.context,
      options.enabled,
      options.split,
      options.ownSplit,
    ],
    () => {
      if (session) {
        cancel()
      }
    },
    { flush: 'sync' },
  )

  onBeforeUnmount(() => {
    cleanup()
    removeClickSuppression()
    options.content.value?.removeEventListener('touchmove', preventTouchScroll, true)
  })

  return {
    enabled: options.enabled,
    isActive: readonly(isActive),
    start,
    startWhole,
    candidate,
    cancel,
  }
}
