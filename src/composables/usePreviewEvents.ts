import type { NoteData } from 'chart-types'
import type { ExtendedNoteData, Measure, PreviewEvent, PreviewEvents } from '../types'
import { getValidatedOptions } from './useNoteCheck'

/** 譜面上の到達時刻ごとに、表示・コンボ・音のイベントをまとめる。 */
export function buildPreviewEvents(
  chart: ExtendedNoteData[],
  measures: Measure[],
  defaultLEDColor: string,
): PreviewEvents {
  const events: PreviewEvents = {}
  const timingOf = (note: NoteData): number | null => {
    const measure = measures[note.measure]
    if (!measure) return null
    const timing = measure.measureReachTime + note.position / note.split * measure.measureLength
    return Number.isFinite(timing) ? timing : null
  }
  // タイミングをkeyにイベント情報をセット
  const ensureEvent = (timing: number): PreviewEvent => events[timing] ??= {
    timing, // 到達時間(ms)
    lane: [], // キービームを出すレーン番号
    hold: [], // キービームを出し続けるレーン番号と継続時間(ms)
    holdEnd: [], // キービームを止めるレーン番号
    color: null, // LED変化の色
    count: 0, // 増加するコンボ数
    sound: false, // 再生するタップ音
    endSound: false, // LN終点音の設定に従って再生する音
    handMove: null, // 手の動き(LeapMotion)
    noteObject: null, // ノートのオブジェクト(Type: 3, 4, 6, 7)
  }

  chart.forEach(note => {
    if (![1, 2, 3, 4, 5, 6, 7, 96].includes(note.type)) return
    const timing = timingOf(note)
    if (timing === null) return
    const event = ensureEvent(timing)

    // 通常・音札（音札はレーン0のキービームを使用）
    if (note.type === 1 || note.type === 5) {
      event.sound = true
      event.count += 1
      const lane = note.type === 5 ? 0 : note.lane
      if (!event.lane.includes(lane)) event.lane.push(lane)
    // LN (始点レーンで発光維持、各中継点・終点到達時のコンボ・効果音処理)
    } else if (note.type === 2) {
      event.sound = true
      if (!event.lane.includes(note.lane)) event.lane.push(note.lane)
      let lastTiming = timing

      const traverse = (node: NoteData) => {
        if (![1, 89].includes(node.type)) return
        const children = Array.isArray(node.end) ? node.end : []
        const nodeTiming = timingOf(node)
        if (nodeTiming !== null) {
          if (children.length > 0) {
            // 中継点: type: 1 の場合のみコンボ+1と効果音
            if (node.type === 1) {
              const nodeEvent = ensureEvent(nodeTiming)
              nodeEvent.sound = true
              nodeEvent.count += 1
            }
          } else {
            // 末端終点: type: 1 または type: 89 でコンボ+1
            const nodeEvent = ensureEvent(nodeTiming)
            nodeEvent.count += 1
            // 終点音を再生するのはtype: 1のみ（ホールドの終了処理とは分離）
            if (node.type === 1) nodeEvent.endSound = true
            lastTiming = Math.max(lastTiming, nodeTiming)
          }
        }
        children.forEach(traverse)
      }
      if (Array.isArray(note.end)) note.end.forEach(traverse)

      // 始点から最長の終点までのホールド光を追加 (同一レーンは最大遅延に集約)
      if (lastTiming > timing) {
        const existing = event.hold.find(([lane]) => lane === note.lane)
        if (existing) existing[1] = Math.max(existing[1], lastTiming - timing)
        else event.hold.push([note.lane, lastTiming - timing])
      }
    // フリック
    } else if ([3, 4, 6, 7].includes(note.type)) {
      event.sound = true
      event.count += 1
      event.noteObject = note
      const moves: Record<number, PreviewEvent['handMove']> = {
        3: '-left', 4: '-right', 6: '-up', 7: '-down',
      }
      // 手の動き LeapMotion補助線
      event.handMove = moves[note.type]
    // LED制御
    } else if (note.type === 96) {
      const rgb = getValidatedOptions(note)
      // (-1, -1, -1)の時はデフォルトに戻す
      event.color = rgb.slice(0, 3).every(value => Number(value) === -1)
        ? defaultLEDColor
        : `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    }
  })
  return events
}

type KeybeamElements = ArrayLike<HTMLElement> | null | undefined

/** パルスの重なりと、音源時刻から求めたホールド状態を管理する。 */
export function createKeybeamController(getElements: () => KeybeamElements) {
  const active = new Map<HTMLElement, number>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let held = new Set<HTMLElement>()

  function pulse(lane: number) {
    const element = getElements()?.[Math.round(lane)]
    if (!element) return
    active.set(element, (active.get(element) ?? 0) + 1)
    element.classList.add('-on')
    const timer = setTimeout(() => {
      timers.delete(timer)
      const count = (active.get(element) ?? 1) - 1
      if (count === 0) {
        element.classList.remove('-on')
        active.delete(element)
      } else active.set(element, count)
    }, 25)
    timers.add(timer)
  }

  return {
    pulse,
    setHolds(lanes: number[]) {
      const next = new Set(lanes.map(lane => getElements()?.[Math.round(lane)]).filter(Boolean) as HTMLElement[])
      held.forEach(element => { if (!next.has(element)) element.classList.remove('-hold') })
      next.forEach(element => { if (!held.has(element)) element.classList.add('-hold') })
      held = next
    },
    stop() {
      timers.forEach(timer => clearTimeout(timer))
      timers.clear()
      active.forEach((_, element) => element.classList.remove('-on', '-hold'))
      active.clear()
      held.forEach(element => element.classList.remove('-hold'))
      held.clear()
    },
  }
}

type PreviewPlaybackOptions = {
  getKeybeams: () => KeybeamElements
  isShowKeybeam: () => boolean
  isPlayKeySound: () => boolean
  isPlayKeySoundEnd: () => boolean
  playSound: () => void
  onEvent: (event: PreviewEvent) => void
  onPastEvent: (event: PreviewEvent) => void
  onSeek?: (color: string | null) => void
}

/** 再生位置より過去の音を鳴らさず、継続中のホールドだけを復元する。 */
export function createPreviewEventPlayer(options: PreviewPlaybackOptions) {
  const beams = createKeybeamController(options.getKeybeams)
  const holds = new Map<number, number>()
  let events: PreviewEvent[] = []
  let cursor = 0
  let previousTime = -Infinity
  let running = false
  const processed = new Set<PreviewEvent>()
  const hold = (event: PreviewEvent) => event.hold.forEach(([lane, duration]) => {
    holds.set(lane, Math.max(holds.get(lane) ?? -Infinity, event.timing + duration))
  })
  const updateHolds = (time: number) => {
    holds.forEach((end, lane) => { if (end <= time) holds.delete(lane) })
    beams.setHolds(options.isShowKeybeam() ? [...holds.keys()] : [])
  }
  function stop() {
    running = false
    holds.clear()
    beams.stop()
  }

  function seek(time: number, includeStart = false) {
    if (!running) return
    beams.stop()
    holds.clear()
    cursor = 0
    previousTime = time
    let color: string | null = null
    while (cursor < events.length && (includeStart ? events[cursor].timing < time : events[cursor].timing <= time)) {
      const event = events[cursor++]
      if (!processed.has(event)) {
        processed.add(event)
        options.onPastEvent(event)
      }
      if (event.color) color = event.color
      hold(event)
    }
    updateHolds(time)
    options.onSeek?.(color)
  }

  return {
    stop,
    // オフセット調整では過去の音を鳴らさず、処理済みイベントも再実行しない。
    seek,
    start(source: PreviewEvents, offset: number, { includeStart = false } = {}) {
      stop()
      events = Object.values(source).sort((a, b) => a.timing - b.timing)
      cursor = 0
      running = true
      processed.clear()
      seek(offset, includeStart)
    },
    /** 音源と同じ絶対時刻を渡す。バッファ待ち中はホールドも進めない。 */
    update(time: number) {
      if (!running) return
      if (time < previousTime) { seek(time); return }
      previousTime = time
      while (cursor < events.length && events[cursor].timing <= time) {
        const event = events[cursor++]
        hold(event)
        if (processed.has(event)) {
          if (event.color) options.onSeek?.(event.color)
          continue
        }
        processed.add(event)
        // 長い描画停止後に過去の打鍵音をまとめて鳴らさず、状態だけを追いつかせる。
        if (time - event.timing <= 50) {
          // 打鍵音と終点音が同じ時刻にあっても、再生は1回にまとめる
          if (options.isPlayKeySound() && (event.sound || (event.endSound && options.isPlayKeySoundEnd()))) {
            options.playSound()
          }
          // キービームを出す
          if (options.isShowKeybeam()) {
            // 単押し
            event.lane.forEach(lane => beams.pulse(lane))
          }
          options.onEvent(event)
        } else options.onPastEvent(event)
      }
      updateHolds(time)
    },
  }
}
