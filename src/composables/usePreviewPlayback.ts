import type { Measure } from '../types'
import { createPreviewClock } from './usePreviewClock'

export type PreviewPhase = 'idle' | 'preparing' | 'counting-in' | 'starting' | 'playing'

type PlaybackOptions = {
  onFrame: (chartTime: number) => void
  onEnd: () => void
  onError: (error: Error) => void
}

type PlaybackInput = {
  audio?: HTMLAudioElement
  prepare?: () => Promise<void>
  measures: Measure[]
  startMeasure: number
  countInMs: number
  volume: number
  getEndTime?: () => number
}

/** 同時刻のWARPはすべて通過し、その後の小節を選ぶ。 */
export function getPreviewMeasureIndex(measures: Measure[], time: number): number {
  let low = 0
  let high = measures.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (measures[middle].measureReachTime <= time) low = middle + 1
    else high = middle
  }
  return Math.max(0, low - 1)
}

/** 到達時刻と位置から絶対座標を求める。STOPでは高さ0、WARPでは時間0となる。 */
export function getPreviewPosition(measures: Measure[], time: number): number {
  const measure = measures[getPreviewMeasureIndex(measures, time)]
  if (!measure) return 0
  if (measure.measureLength === 0) {
    return measure.measurePositionBottom + (time >= measure.measureReachTime ? measure.measureHeight : 0)
  }
  const progress = Math.min(1, (time - measure.measureReachTime) / measure.measureLength)
  return measure.measurePositionBottom + progress * measure.measureHeight
}

const PREPARATION_TIMEOUT = 15000

/** メディアの準備を待つ間も、停止時にリスナーとタイムアウトを必ず解放する。 */
function waitForMedia(audio: HTMLAudioElement, ready: () => boolean, signal: AbortSignal, action?: () => void) {
  return new Promise<void>((resolve, reject) => {
    const events = ['loadedmetadata', 'loadeddata', 'canplay', 'seeked']
    const cleanup = () => {
      clearTimeout(timeout)
      events.forEach(event => audio.removeEventListener(event, check))
      audio.removeEventListener('error', fail)
      signal.removeEventListener('abort', abort)
    }
    const finish = (error?: Error) => {
      cleanup()
      if (error) reject(error)
      else resolve()
    }
    const check = () => { if (ready()) finish() }
    const fail = () => finish(new Error('音源を読み込めませんでした'))
    const abort = () => finish(new DOMException('再生を中止しました', 'AbortError'))
    const timeout = setTimeout(() => finish(new Error('音源の準備がタイムアウトしました')), PREPARATION_TIMEOUT)
    events.forEach(event => audio.addEventListener(event, check))
    audio.addEventListener('error', fail)
    signal.addEventListener('abort', abort, { once: true })
    try {
      if (signal.aborted) abort()
      else {
        action?.()
        if (audio.error) fail()
        else check()
      }
    } catch (error) { finish(error as Error) }
  })
}

function waitForOperation(promise: Promise<void>, signal: AbortSignal, timeoutMessage: string) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
    }
    const finish = (error?: Error) => {
      cleanup()
      if (error) reject(error)
      else resolve()
    }
    const abort = () => finish(new DOMException('再生を中止しました', 'AbortError'))
    const timeout = setTimeout(() => finish(new Error(timeoutMessage)), PREPARATION_TIMEOUT)
    signal.addEventListener('abort', abort, { once: true })
    promise.then(() => finish(), finish)
    if (signal.aborted) abort()
  })
}

/**
 * 譜面時刻 = 音源のcurrentTime(ms) + 先頭のカウントイン長。
 * offsetはmeasureReachTimeに含まれるので、ここでは加算しない。
 */
export function createPreviewPlayback(options: PlaybackOptions) {
  let phase: PreviewPhase = 'idle'
  let current: { controller: AbortController; frame?: number; audio?: HTMLAudioElement; cleanup: () => void } | undefined

  function stop() {
    const previous = current
    current = undefined
    phase = 'idle'
    if (!previous) return
    previous.controller.abort()
    if (previous.frame !== undefined) cancelAnimationFrame(previous.frame)
    previous.cleanup()
    previous.audio?.pause()
  }

  async function start(input: PlaybackInput) {
    stop()
    const { countInMs, startMeasure } = input
    const measures = input.measures.map(measure => ({ ...measure }))
    const selected = measures[startMeasure]
    if (!selected || !Number.isFinite(countInMs) || countInMs < 0) {
      options.onError(new Error('再生開始小節・BPM・拍子を確認してください'))
      return
    }
    const audio = input.audio?.src || input.audio?.currentSrc ? input.audio : undefined
    const session = { controller: new AbortController(), frame: undefined as number | undefined, audio, cleanup: () => {} }
    const clock = createPreviewClock()
    let buffering = false
    current = session
    const active = () => current === session
    const finish = () => { if (active()) { stop(); options.onEnd() } }
    const fail = (error: unknown) => {
      if (active()) {
        stop()
        options.onError(error instanceof Error ? error : new Error(String(error)))
      }
    }
    // 0は従来どおり先頭再生。それ以外は指定小節の頭をカウントイン後に再生する。
    const target = startMeasure === 0 ? countInMs : selected.measureReachTime
    const from = target - countInMs
    const audioStart = Math.max(target, countInMs)
    const last = measures.at(-1)!
    const end = last.measureReachTime + last.measureLength
    phase = 'preparing'
    options.onFrame(from)

    try {
      if (input.prepare) {
        await waitForOperation(input.prepare(), session.controller.signal, '補助音の準備がタイムアウトしました')
        if (!active()) return
      }
      if (audio) {
        const source = audio.src
        const sourceChanged = () => {
          if (audio.src !== source || phase !== 'preparing') fail(new Error('音源が変更されました'))
        }
        audio.addEventListener('emptied', sourceChanged)
        session.cleanup = () => audio.removeEventListener('emptied', sourceChanged)
        audio.pause()
        audio.preload = 'auto'
        audio.volume = Math.max(0, Math.min(1, input.volume))
        await waitForMedia(audio, () => audio.readyState >= 1, session.controller.signal, () => {
          if (audio.readyState === 0) audio.load()
        })
        if (!active()) return
        const seekTo = Math.max(0, target - countInMs) / 1000
        if (Number.isFinite(audio.duration) && seekTo >= audio.duration) throw new Error('再生開始位置が音源の長さを超えています')
        await waitForMedia(audio, () => !audio.seeking && audio.readyState >= 2, session.controller.signal, () => {
          if (Math.abs(audio.currentTime - seekTo) > 0.001) audio.currentTime = seekTo
        })
        if (!active()) return
        const mediaError = () => fail(new Error('音源の再生が中断されました'))
        const resetClock = () => clock.reset()
        const waiting = () => { buffering = true; clock.reset() }
        const playing = () => { buffering = false; clock.reset() }
        const seeked = () => { buffering = audio.readyState < 3; clock.reset() }
        audio.addEventListener('ended', finish)
        audio.addEventListener('error', mediaError)
        audio.addEventListener('emptied', mediaError)
        audio.addEventListener('waiting', waiting)
        audio.addEventListener('playing', playing)
        audio.addEventListener('seeking', resetClock)
        audio.addEventListener('seeked', seeked)
        audio.addEventListener('ratechange', resetClock)
        session.cleanup = () => {
          audio.removeEventListener('emptied', sourceChanged)
          audio.removeEventListener('ended', finish)
          audio.removeEventListener('error', mediaError)
          audio.removeEventListener('emptied', mediaError)
          audio.removeEventListener('waiting', waiting)
          audio.removeEventListener('playing', playing)
          audio.removeEventListener('seeking', resetClock)
          audio.removeEventListener('seeked', seeked)
          audio.removeEventListener('ratechange', resetClock)
        }
      }
      if (!active()) return
      phase = 'counting-in'
      const began = performance.now()

      const beginAudio = async () => {
        phase = 'starting'
        try {
          await waitForOperation(audio!.play(), session.controller.signal, '音源を再生開始できませんでした')
          if (active()) {
            clock.reset()
            phase = 'playing'
          }
        } catch (error) { fail(error) }
      }
      const tick = () => {
        if (!active()) return
        let time: number
        if (!audio) {
          time = from + performance.now() - began
          if (time >= target) phase = 'playing'
        } else if (phase === 'playing') {
          time = clock.read(audio.currentTime * 1000, performance.now(), {
            running: !buffering && !audio.paused && !audio.seeking && audio.readyState >= 3,
            playbackRate: audio.playbackRate ?? 1,
          }) + countInMs
        } else {
          time = Math.min(audioStart, from + performance.now() - began)
          if (time >= audioStart && phase === 'counting-in') void beginAudio()
        }
        if (!active()) return
        // play()が完了するまでは直前の描画を維持し、到達音も先行させない。
        if (phase === 'starting') {
          session.frame = requestAnimationFrame(tick)
          return
        }
        const endTime = input.getEndTime?.() ?? end
        options.onFrame(Math.min(time, endTime))
        if (time >= endTime) finish()
        else if (active()) session.frame = requestAnimationFrame(tick)
      }
      session.frame = requestAnimationFrame(tick)
    } catch (error) { fail(error) }
  }

  return { start, stop, get phase() { return phase } }
}
