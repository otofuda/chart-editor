import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExtendedNoteData, Measure } from '../../types'
import { buildPreviewEvents, createKeybeamController, createPreviewEventPlayer } from '../usePreviewEvents'

function note(overrides: Partial<ExtendedNoteData> = {}): ExtendedNoteData {
  return { type: 1, lane: 1, measure: 0, position: 0, split: 4, option: [], end: [], ...overrides }
}

const measures: Measure[] = [{
  measure: 0, measureBeat: 4, measureBpm: 120, measureHeight: 400,
  measureLength: 1000, measurePositionBottom: 0, measureReachTime: 100,
}]
const build = (notes: ExtendedNoteData[]) => buildPreviewEvents(notes, measures, 'default-led')
const branch = () => note({ type: 2, end: [note({ position: 1 }), note({ position: 3 })] })

function setupPlayback(settings = { beam: true, sound: true, endSound: true }) {
  const elements = Array.from({ length: 6 }, () => document.createElement('div'))
  const playSound = vi.fn()
  const onEvent = vi.fn()
  const onPastEvent = vi.fn()
  const player = createPreviewEventPlayer({
    getKeybeams: () => elements,
    isShowKeybeam: () => settings.beam,
    isPlayKeySound: () => settings.sound,
    isPlayKeySoundEnd: () => settings.endSound,
    playSound, onEvent, onPastEvent,
  })
  return { elements, playSound, onEvent, onPastEvent, player }
}

describe('buildPreviewEvents', () => {
  it('多段分岐のホールドを最長の終点まで維持し、各到達時刻のコンボを保持する', () => {
    const events = build([note({ type: 2, end: [
      note({ position: 1 }),
      note({ position: 2, end: [note({ type: 89, position: 3 })] }),
    ] })])
    expect(events[100].hold).toEqual([[1, 750]])
    expect(events[100].count).toBe(0)
    expect(events[350]).toMatchObject({ count: 1, sound: false, endSound: true })
    expect(events[600]).toMatchObject({ count: 1, sound: true, endSound: false })
    expect(events[850]).toMatchObject({ count: 1, sound: false, endSound: false })
  })

  it('不可視中点はコンボと音を加算しない', () => {
    const events = build([note({ type: 2, end: [note({ type: 89, position: 1, end: [note({ position: 3 })] })] })])
    expect(events[350]).toBeUndefined()
    expect(events[100].hold).toEqual([[1, 750]])
    expect(events[850].count).toBe(1)
  })

  it('同時刻の複数終点と通常音をひとつのイベントにまとめる', () => {
    const events = build([
      note({ type: 2, end: [note({ position: 3 }), note({ position: 3, lane: 2 })] }),
      note({ position: 3, lane: 3 }),
    ])
    expect(events[850]).toMatchObject({ count: 3, sound: true, endSound: true, lane: [3] })
  })

  it('ダミーや存在しない小節は音・コンボ・ホールドを生成しない', () => {
    expect(build([note({ type: 90, option: ['2'], end: [note({ position: 3 })] }), note({ measure: 99 })]))
      .toEqual({})
  })

  it('音札・フリック・LEDのイベントを維持し、LEDの空欄は0で補完する', () => {
    const events = build([
      note({ type: 5 }), note({ type: 6, position: 1 }),
      note({ type: 96, position: 2, option: ['', '', '128'] }),
      note({ type: 96, position: 3, option: ['-1', '-1', '-1'] }),
    ])
    expect(events[100]).toMatchObject({ lane: [0], sound: true, count: 1 })
    expect(events[350]).toMatchObject({ handMove: '-up', sound: true, count: 1 })
    expect(events[600].color).toBe('rgb(0,0,128)')
    expect(events[850].color).toBe('default-led')
  })
})

describe('プレビュー再生', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

  it('分岐の短い終点では消灯せず、最長の終点で消灯する', () => {
    const { elements, player } = setupPlayback()
    player.start(build([branch()]), 0)
    vi.advanceTimersByTime(100)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    vi.advanceTimersByTime(250)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    vi.advanceTimersByTime(500)
    expect(elements[1].classList.contains('-hold')).toBe(false)
  })

  it('小数レーン1.1と1.4が同じ発光先に丸められても、最後のLNまで維持する', () => {
    const { elements, player } = setupPlayback()
    player.start(build([
      note({ type: 2, lane: 1.1 as any, end: [note({ position: 1 })] }),
      note({ type: 2, lane: 1.4 as any, end: [note({ position: 3 })] }),
    ]), 0)
    vi.advanceTimersByTime(350)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    vi.advanceTimersByTime(500)
    expect(elements[1].classList.contains('-hold')).toBe(false)
  })

  it.each([[2, 3], [3, 2]])('開始時刻が異なるLNを保持する（先行終点%s・後続終点%s）', (firstEnd, secondEnd) => {
    const { elements, player } = setupPlayback()
    player.start(build([
      note({ type: 2, end: [note({ position: firstEnd })] }),
      note({ type: 2, position: 1, end: [note({ position: secondEnd })] }),
    ]), 0)
    vi.advanceTimersByTime(600)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    vi.advanceTimersByTime(250)
    expect(elements[1].classList.contains('-hold')).toBe(false)
  })

  it('途中再生では継続中のホールドだけを復元し、過去の音を鳴らさない', () => {
    const { elements, player, playSound, onPastEvent } = setupPlayback()
    player.start(build([branch()]), 500)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    expect(elements[1].classList.contains('-on')).toBe(false)
    expect(onPastEvent).toHaveBeenCalledTimes(2)
    expect(playSound).not.toHaveBeenCalled()
    vi.advanceTimersByTime(349)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    vi.advanceTimersByTime(1)
    expect(elements[1].classList.contains('-hold')).toBe(false)
    expect(playSound).toHaveBeenCalledTimes(1)
  })

  it('再生位置ですでに終了したホールドを点灯しない', () => {
    const { elements, player, playSound } = setupPlayback()
    player.start(build([branch()]), 850)
    expect(elements.every(element => element.className === '')).toBe(true)
    vi.runAllTimers()
    expect(playSound).not.toHaveBeenCalled()
  })

  it('停止で発光と予約イベントを解除し、再再生に古い終了タイマーを持ち越さない', () => {
    const { elements, player, playSound, onEvent } = setupPlayback()
    player.start(build([branch()]), 0)
    vi.advanceTimersByTime(100)
    expect(elements[1].classList.contains('-on')).toBe(true)
    player.stop()
    expect(elements[1].className).toBe('')
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(100)
    player.start(build([branch()]), 0)
    vi.advanceTimersByTime(650)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    vi.advanceTimersByTime(200)
    expect(elements[1].classList.contains('-hold')).toBe(false)
    expect(playSound).toHaveBeenCalledTimes(4)
    expect(onEvent).toHaveBeenCalledTimes(4)
  })

  it.each([
    [false, false, 0], [false, true, 0], [true, false, 1], [true, true, 3],
  ])('打鍵音=%s・終点音=%s の条件に従い二重再生しない', (sound, endSound, expected) => {
    const { player, playSound } = setupPlayback({ beam: false, sound, endSound })
    player.start(build([branch()]), 0)
    vi.runAllTimers()
    expect(playSound).toHaveBeenCalledTimes(expected)
  })

  it.each([false, true])('終点音=%sでも通常中点は鳴り、type89の末端は無音になる', endSound => {
    const { player, playSound } = setupPlayback({ beam: true, sound: true, endSound })
    player.start(build([note({ type: 2, end: [
      note({ position: 1, end: [note({ type: 89, position: 3 })] }),
    ] })]), 0)
    vi.runAllTimers()
    expect(playSound).toHaveBeenCalledTimes(2)
  })

  it('同時刻の複数終点とタップを、発光DOMがなくても1回だけ鳴らす', () => {
    const playSound = vi.fn()
    const player = createPreviewEventPlayer({
      getKeybeams: () => null,
      isShowKeybeam: () => true, isPlayKeySound: () => true, isPlayKeySoundEnd: () => true,
      playSound, onEvent: vi.fn(), onPastEvent: vi.fn(),
    })
    player.start(build([
      note({ type: 2, end: [note({ position: 3 }), note({ position: 3 })] }),
      note({ position: 3 }),
    ]), 0)
    vi.runAllTimers()
    expect(playSound).toHaveBeenCalledTimes(2)
  })

  it('現在の丸め方とDOM存在確認を維持し、範囲外でも例外にならない', () => {
    const elements = Array.from({ length: 6 }, () => document.createElement('div'))
    const beams = createKeybeamController(() => elements)
    expect(() => {
      for (const lane of [0, 1.5, 6, -100, 99, NaN]) {
        beams.pulse(lane)
        beams.hold(lane, 100)
      }
    }).not.toThrow()
    expect(elements[0].classList.contains('-hold')).toBe(true)
    expect(elements[2].classList.contains('-hold')).toBe(true)
    vi.runAllTimers()
    expect(elements.every(element => element.className === '')).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
