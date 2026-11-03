import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Measure } from '../../types'
import { createPreviewPlayback, getPreviewPosition } from '../usePreviewPlayback'
import { useChartData } from '../useChartData'

const measures: Measure[] = Array.from({ length: 6 }, (_, measure) => ({
  measure, measureBeat: 4, measureBpm: 120, measureHeight: 400,
  measureLength: 2000, measurePositionBottom: measure * 400, measureReachTime: measure * 2000,
}))

class AudioTrack extends EventTarget {
  src = 'blob:track'
  currentSrc = this.src
  duration = 60
  readyState = 4
  seeking = false
  error = null
  preload = ''
  volume = 1
  time = 0
  get currentTime() { return this.time }
  set currentTime(value: number) { this.time = value; this.seeking = true }
  load = vi.fn()
  pause = vi.fn()
  play = vi.fn(() => Promise.resolve())
  seeked() { this.seeking = false; this.dispatchEvent(new Event('seeked')) }
}

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
let frames: Map<number, FrameRequestCallback>
let nextFrame: number
function frame(elapsed = 0) {
  vi.advanceTimersByTime(elapsed)
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach(callback => callback(performance.now()))
}

function setup(audio = new AudioTrack()) {
  const onFrame = vi.fn()
  const onEnd = vi.fn()
  const onError = vi.fn()
  const playback = createPreviewPlayback({ onFrame, onEnd, onError })
  const start = (overrides = {}) => playback.start({
    audio: audio as unknown as HTMLAudioElement, measures, startMeasure: 0, countInMs: 2000, volume: 0.5, ...overrides,
  })
  return { audio, onFrame, onEnd, onError, playback, start }
}

beforeEach(() => {
  vi.useFakeTimers()
  frames = new Map()
  nextFrame = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('音源を基準にしたプレビュー再生', () => {
  it('補助音の初回準備が終わるまで譜面も音源も進めない', async () => {
    const s = setup()
    let resolve!: () => void
    const prepare = vi.fn(() => new Promise<void>(done => { resolve = done }))
    const pending = s.start({ prepare })
    expect(prepare).toHaveBeenCalledOnce()
    frame(1000)
    expect(s.playback.phase).toBe('preparing')
    expect(s.onFrame.mock.calls).toEqual([[0]])
    expect(s.audio.play).not.toHaveBeenCalled()
    resolve()
    await pending
    frame(1999)
    expect(s.audio.play).not.toHaveBeenCalled()
    frame(1)
    await flush()
    expect(s.audio.play).toHaveBeenCalledOnce()
    s.playback.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['resolve', 'reject'])('停止した補助音準備の%sが次の再生に混入しない', async result => {
    const s = setup()
    let resolve!: () => void
    let reject!: (error: Error) => void
    const first = s.start({ prepare: () => new Promise<void>((done, fail) => { resolve = done; reject = fail }) })
    s.playback.stop()
    await first
    expect(vi.getTimerCount()).toBe(0)
    await s.start()
    if (result === 'resolve') resolve()
    else reject(new Error('load failed'))
    await flush()
    frame(2000)
    await flush()
    expect(s.audio.play).toHaveBeenCalledOnce()
    expect(s.onError).not.toHaveBeenCalled()
    expect(s.playback.phase).toBe('playing')
    s.playback.stop()
  })

  it('補助音の準備失敗は停止表示へ戻し、再操作を可能にする', async () => {
    const s = setup()
    await s.start({ prepare: () => Promise.reject(new Error('補助音を読み込めませんでした')) })
    expect(s.playback.phase).toBe('idle')
    expect(s.onError).toHaveBeenCalledOnce()
    expect(frames.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    await s.start({ prepare: () => Promise.resolve() })
    frame(2000)
    await flush()
    expect(s.audio.play).toHaveBeenCalledOnce()
    s.playback.stop()
  })

  it('補助音の準備タイムアウトでも予約を解除する', async () => {
    const s = setup()
    const pending = s.start({ prepare: () => new Promise<void>(() => {}) })
    frame(15000)
    await pending
    expect(s.playback.phase).toBe('idle')
    expect(s.onError).toHaveBeenCalledWith(new Error('補助音の準備がタイムアウトしました'))
    expect(frames.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('初回のメタデータとデコードを待ってからカウントインする', async () => {
    const s = setup()
    s.audio.readyState = 0
    const pending = s.start()
    frame(1000)
    expect(s.playback.phase).toBe('preparing')
    expect(s.audio.load).toHaveBeenCalledOnce()
    expect(s.audio.play).not.toHaveBeenCalled()
    expect(s.onFrame.mock.calls).toEqual([[0]])
    s.audio.readyState = 1
    s.audio.dispatchEvent(new Event('loadedmetadata'))
    await flush()
    expect(s.playback.phase).toBe('preparing')
    s.audio.readyState = 4
    s.audio.dispatchEvent(new Event('canplay'))
    await pending
    expect(s.playback.phase).toBe('counting-in')
    frame(1999)
    expect(s.audio.play).not.toHaveBeenCalled()
    frame(1)
    await flush()
    expect(s.audio.play).toHaveBeenCalledOnce()
    expect(s.playback.phase).toBe('playing')
    s.playback.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([0, 120, 800])('再生開始が%sms遅れても、開始前に譜面を進めず音声時刻へ追従する', async delay => {
    const s = setup()
    let resolve!: () => void
    s.audio.play.mockImplementation(() => new Promise<void>(done => { resolve = done }))
    await s.start()
    frame(1990)
    frame(10)
    frame(delay)
    expect(s.playback.phase).toBe('starting')
    expect(s.onFrame).toHaveBeenLastCalledWith(1990)
    s.audio.time = 0.037
    resolve()
    await flush()
    frame()
    expect(s.onFrame).toHaveBeenLastCalledWith(2037)
    frame(5000)
    expect(s.onFrame).toHaveBeenLastCalledWith(2037)
    s.audio.time = 5.123
    frame()
    expect(s.onFrame).toHaveBeenLastCalledWith(7123)
    s.playback.stop()
  })

  it('途中小節のシーク完了後にカウントインし、指定小節の頭と音源を揃える', async () => {
    const s = setup()
    const pending = s.start({ startMeasure: 2 })
    await flush()
    expect(s.audio.currentTime).toBe(2)
    expect(s.playback.phase).toBe('preparing')
    frame(500)
    expect(s.audio.play).not.toHaveBeenCalled()
    s.audio.seeked()
    await pending
    frame(1000)
    expect(s.onFrame).toHaveBeenLastCalledWith(3000)
    frame(1000)
    await flush()
    frame()
    expect(s.onFrame).toHaveBeenLastCalledWith(4000)
    expect(getPreviewPosition(measures, 4000)).toBe(800)
    s.playback.stop()
  })

  it('音源が50ms刻みで更新されても描画は60fpsで進み、バッファ待ちはすぐ停止する', async () => {
    const s = setup()
    await s.start()
    frame(2000)
    await flush()
    frame()
    let previous = s.onFrame.mock.calls.at(-1)![0]
    for (let n = 1; n <= 60; n++) {
      s.audio.time = Math.floor(n * 16 / 50) * 0.05
      frame(16)
      const time = s.onFrame.mock.calls.at(-1)![0]
      expect(time - previous).toBeGreaterThan(15)
      expect(time - previous).toBeLessThan(17)
      previous = time
    }
    s.audio.dispatchEvent(new Event('waiting'))
    frame(16)
    const stopped = s.onFrame.mock.calls.at(-1)![0]
    frame(1000)
    expect(s.onFrame).toHaveBeenLastCalledWith(stopped)
    s.audio.dispatchEvent(new Event('playing'))
    frame()
    expect(s.onFrame).toHaveBeenLastCalledWith(s.audio.time * 1000 + 2000)
    frame(16)
    expect(s.onFrame.mock.calls.at(-1)![0]).toBeGreaterThan(stopped)
    s.playback.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([-250, 250])('offset=%sでも先頭と途中で同じ音源時刻に同じ位置を描画する', async offset => {
    const data = useChartData()
    data.chartObject.value.info.offset = offset
    data.chartObject.value.easy = [{ type: 1, lane: 1, measure: 5, position: 0, split: 4, option: [], end: [] }]
    const chartMeasures = data.measureData.value
    for (const startMeasure of [0, 2]) {
      const s = setup()
      const pending = s.start({ measures: chartMeasures, startMeasure })
      await flush()
      if (s.audio.seeking) s.audio.seeked()
      await pending
      frame(2000)
      await flush()
      s.audio.time = 4
      frame()
      expect(s.onFrame).toHaveBeenLastCalledWith(6000)
      expect(getPreviewPosition(chartMeasures, 6000)).toBe(1200)
      s.playback.stop()
    }
  })

  it('負の音源位置から途中開始すると、無音の残り時間を経て音源の0秒から始める', async () => {
    const s = setup()
    const shifted = measures.map(m => ({ ...m, measureReachTime: m.measureReachTime - 250 }))
    await s.start({ measures: shifted, startMeasure: 1 })
    frame(2000)
    expect(s.onFrame).toHaveBeenLastCalledWith(1750)
    expect(s.audio.play).not.toHaveBeenCalled()
    frame(250)
    await flush()
    frame()
    expect(s.onFrame).toHaveBeenLastCalledWith(2000)
    s.playback.stop()
  })

  it('再生→即停止→再生を10回繰り返しても最後の予約だけが再生する', async () => {
    const s = setup()
    for (let i = 0; i < 10; i++) {
      await s.start()
      frame(50)
      s.playback.stop()
      expect(frames.size).toBe(0)
      expect(vi.getTimerCount()).toBe(0)
    }
    await s.start()
    frame(2000)
    await flush()
    expect(s.audio.play).toHaveBeenCalledOnce()
    s.playback.stop()
  })

  it('停止した初回準備の完了が次の再生に混入しない', async () => {
    const s = setup()
    s.audio.readyState = 0
    const first = s.start()
    s.playback.stop()
    s.audio.readyState = 4
    await s.start()
    s.audio.dispatchEvent(new Event('canplay'))
    await first
    frame(2000)
    await flush()
    expect(s.audio.play).toHaveBeenCalledOnce()
    s.playback.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('停止したplay()の遅い失敗は次の再生を停止しない', async () => {
    const s = setup()
    let reject!: (error: Error) => void
    s.audio.play.mockImplementationOnce(() => new Promise<void>((_, fail) => { reject = fail }))
    await s.start()
    frame(2000)
    s.playback.stop()
    await s.start()
    reject(new DOMException('paused', 'AbortError'))
    await flush()
    expect(s.onError).not.toHaveBeenCalled()
    expect(s.playback.phase).toBe('counting-in')
    frame(2000)
    await flush()
    expect(s.playback.phase).toBe('playing')
    s.playback.stop()
  })

  it('play呼び出し中にファイル変更で停止しても、古いフレームを描画・再予約しない', async () => {
    const s = setup()
    s.audio.play.mockImplementation(() => { s.playback.stop(); return Promise.resolve() })
    await s.start()
    const framesBefore = s.onFrame.mock.calls.length
    frame(2000)
    await flush()
    expect(s.playback.phase).toBe('idle')
    expect(s.onFrame).toHaveBeenCalledTimes(framesBefore)
    expect(frames.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('再生拒否から復旧して単発で再操作できる', async () => {
    const s = setup()
    s.audio.play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
    await s.start()
    frame(2000)
    await flush()
    expect(s.onError).toHaveBeenCalledOnce()
    expect(s.playback.phase).toBe('idle')
    expect(frames.size).toBe(0)
    await s.start()
    frame(2000)
    await flush()
    expect(s.playback.phase).toBe('playing')
    s.playback.stop()
  })

  it('準備のタイムアウトで停止し、イベントリスナーを持ち越さない', async () => {
    const s = setup()
    s.audio.readyState = 0
    const remove = vi.spyOn(s.audio, 'removeEventListener')
    const pending = s.start()
    frame(15000)
    await pending
    expect(s.playback.phase).toBe('idle')
    expect(s.onError).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledWith('canplay', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('準備中の音源変更でも古い再生を開始しない', async () => {
    const s = setup()
    s.audio.readyState = 0
    const pending = s.start()
    s.audio.src = 'blob:other-track'
    s.audio.dispatchEvent(new Event('emptied'))
    s.audio.readyState = 4
    s.audio.dispatchEvent(new Event('canplay'))
    await pending
    frame(3000)
    expect(s.audio.play).not.toHaveBeenCalled()
    expect(s.onError).toHaveBeenCalledOnce()
    expect(s.playback.phase).toBe('idle')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('シーク待ちの停止でも予約を解除する', async () => {
    const s = setup()
    const pending = s.start({ startMeasure: 2 })
    await flush()
    expect(s.audio.seeking).toBe(true)
    s.playback.stop()
    s.audio.seeked()
    await pending
    frame(3000)
    expect(s.audio.play).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['ended', 'error', 'emptied'])('%sで音源と描画を終了する', async event => {
    const s = setup()
    await s.start()
    frame(2000)
    await flush()
    s.audio.dispatchEvent(new Event(event))
    expect(s.playback.phase).toBe('idle')
    expect(frames.size).toBe(0)
    expect(s.audio.pause).toHaveBeenCalled()
  })

  it('音源なしのプレビューも動作し、最後の小節末尾で停止する', async () => {
    const s = setup()
    s.audio.src = s.audio.currentSrc = ''
    await s.start()
    frame(12000)
    expect(s.audio.play).not.toHaveBeenCalled()
    expect(s.onFrame).toHaveBeenLastCalledWith(12000)
    expect(s.onEnd).toHaveBeenCalledOnce()
    expect(s.playback.phase).toBe('idle')
  })

  it('再生中のオフセット調整で延びた譜面末尾まで再生を継続する', async () => {
    const s = setup()
    let end = 12000
    await s.start({ audio: undefined, getEndTime: () => end })
    frame(11000)
    end = 14000
    frame(1500)
    expect(s.playback.phase).toBe('playing')
    expect(s.onEnd).not.toHaveBeenCalled()
    frame(1500)
    expect(s.onFrame).toHaveBeenLastCalledWith(14000)
    expect(s.onEnd).toHaveBeenCalledOnce()
  })
})

describe('譜面時刻からの描画位置', () => {
  it('先頭のWARPも到達前に通過せず、到達時刻にだけジャンプする', () => {
    const m = [
      { ...measures[0], measureLength: 0, measureReachTime: 250, measureHeight: 200 },
      { ...measures[1], measureReachTime: 250, measurePositionBottom: 200 },
    ]
    expect(getPreviewPosition(m, 249)).toBe(0)
    expect(getPreviewPosition(m, 250)).toBe(200)
    expect(getPreviewPosition(m, 1250)).toBe(400)
  })
  it('BPM・拍子変更、STOP、連続WARPを境界の前後で正しく補間する', () => {
    const data = useChartData()
    data.isSimulateStop.value = true
    data.chartObject.value.easy = [
      { type: 98, measure: 1, option: ['240'] },
      { type: 97, measure: 2, option: ['3'] },
      { type: 92, measure: 3, option: [] },
      { type: 93, measure: 4, option: ['2'] },
      { type: 93, measure: 5, option: ['1'] },
      { type: 99, measure: 6, option: [] },
    ] as any
    const m = data.measureData.value
    expect(getPreviewPosition(m, 1000)).toBe(200)
    expect(getPreviewPosition(m, 2500)).toBe(600)
    expect(getPreviewPosition(m, 3500)).toBe(1000)
    expect(getPreviewPosition(m, 4000)).toBe(1100) // STOP中
    expect(getPreviewPosition(m, 4499)).toBe(1100)
    expect(getPreviewPosition(m, 4500)).toBe(1400) // 2つのWARPを同時に通過
    expect(getPreviewPosition(m, 4750)).toBe(1500)
    expect(getPreviewPosition(m, 100000)).toBe(1700)
  })
})
