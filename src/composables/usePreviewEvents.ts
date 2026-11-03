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

/** 同じDOMに丸められた発光を参照数で管理し、最後の発光が終わるまで維持する。 */
export function createKeybeamController(getElements: () => KeybeamElements) {
  const active = new Map<HTMLElement, { '-on': number; '-hold': number }>()
  const timers = new Set<ReturnType<typeof setTimeout>>()

  function activate(lane: number, className: '-on' | '-hold', duration: number) {
    const element = getElements()?.[Math.round(lane)]
    if (!element || !Number.isFinite(duration) || duration <= 0) return
    const counts = active.get(element) ?? { '-on': 0, '-hold': 0 }
    active.set(element, counts)
    counts[className] += 1
    element.classList.add(className)
    const timer = setTimeout(() => {
      timers.delete(timer)
      counts[className] -= 1
      if (counts[className] === 0) element.classList.remove(className)
      if (counts['-on'] === 0 && counts['-hold'] === 0) active.delete(element)
    }, duration)
    timers.add(timer)
  }

  return {
    pulse: (lane: number) => activate(lane, '-on', 25),
    hold: (lane: number, duration: number) => activate(lane, '-hold', duration),
    stop() {
      timers.forEach(timer => clearTimeout(timer))
      timers.clear()
      active.forEach((_, element) => element.classList.remove('-on', '-hold'))
      active.clear()
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
}

/** 再生位置より過去の音を鳴らさず、継続中のホールドだけを復元する。 */
export function createPreviewEventPlayer(options: PreviewPlaybackOptions) {
  const beams = createKeybeamController(options.getKeybeams)
  const timers = new Set<ReturnType<typeof setTimeout>>()
  function stop() {
    timers.forEach(timer => clearTimeout(timer))
    timers.clear()
    beams.stop()
  }

  return {
    stop,
    start(events: PreviewEvents, offset: number) {
      stop()
      Object.values(events).sort((a, b) => a.timing - b.timing).forEach(event => {
        const time = event.timing - offset
        if (time <= 0) {
          options.onPastEvent(event)
          if (options.isShowKeybeam()) {
            event.hold.forEach(([lane, duration]) => beams.hold(lane, duration + time))
          }
          return
        }
        const timer = setTimeout(() => {
          timers.delete(timer)
          // 打鍵音と終点音が同じ時刻にあっても、再生は1回にまとめる
          if (options.isPlayKeySound() && (event.sound || (event.endSound && options.isPlayKeySoundEnd()))) {
            options.playSound()
          }
          // キービームを出す
          if (options.isShowKeybeam()) {
            // 単押し
            event.lane.forEach(lane => beams.pulse(lane))
            // LN(ホールド)
            event.hold.forEach(([lane, duration]) => beams.hold(lane, duration))
          }
          options.onEvent(event)
        }, time)
        timers.add(timer)
      })
    },
  }
}
