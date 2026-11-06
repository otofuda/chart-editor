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
  const onSeek = vi.fn()
  const controller = createPreviewEventPlayer({
    getKeybeams: () => elements,
    isShowKeybeam: () => settings.beam,
    isPlayKeySound: () => settings.sound,
    isPlayKeySoundEnd: () => settings.endSound,
    playSound, onEvent, onPastEvent, onSeek,
  })
  let time = 0
  const player = {
    ...controller,
    start(...args: Parameters<typeof controller.start>) { time = args[1]; controller.start(...args) },
  }
  const advance = (milliseconds: number) => {
    for (let i = 0; i < milliseconds; i++) {
      vi.advanceTimersByTime(1)
      player.update(++time)
    }
  }
  return { elements, playSound, onEvent, onPastEvent, onSeek, player, advance }
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
    const { elements, player, advance } = setupPlayback()
    player.start(build([branch()]), 0)
    advance(100)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    advance(250)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    advance(500)
    expect(elements[1].classList.contains('-hold')).toBe(false)
  })

  it('小数レーン1.1と1.4が同じ発光先に丸められても、最後のLNまで維持する', () => {
    const { elements, player, advance } = setupPlayback()
    player.start(build([
      note({ type: 2, lane: 1.1 as any, end: [note({ position: 1 })] }),
      note({ type: 2, lane: 1.4 as any, end: [note({ position: 3 })] }),
    ]), 0)
    advance(350)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    advance(500)
    expect(elements[1].classList.contains('-hold')).toBe(false)
  })

  it.each([[2, 3], [3, 2]])('開始時刻が異なるLNを保持する（先行終点%s・後続終点%s）', (firstEnd, secondEnd) => {
    const { elements, player, advance } = setupPlayback()
    player.start(build([
      note({ type: 2, end: [note({ position: firstEnd })] }),
      note({ type: 2, position: 1, end: [note({ position: secondEnd })] }),
    ]), 0)
    advance(600)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    advance(250)
    expect(elements[1].classList.contains('-hold')).toBe(false)
  })

  it('途中再生では継続中のホールドだけを復元し、過去の音を鳴らさない', () => {
    const { elements, player, playSound, onPastEvent, advance } = setupPlayback()
    player.start(build([branch()]), 500)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    expect(elements[1].classList.contains('-on')).toBe(false)
    expect(onPastEvent).toHaveBeenCalledTimes(2)
    expect(playSound).not.toHaveBeenCalled()
    advance(349)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    advance(1)
    expect(elements[1].classList.contains('-hold')).toBe(false)
    expect(playSound).toHaveBeenCalledTimes(1)
  })

  it('再生位置ですでに終了したホールドを点灯しない', () => {
    const { elements, player, playSound, advance } = setupPlayback()
    player.start(build([branch()]), 850)
    expect(elements.every(element => element.className === '')).toBe(true)
    advance(1000)
    expect(playSound).not.toHaveBeenCalled()
  })

  it('音源が待機している間はホールドとコンボが進まない', () => {
    const { player, elements, playSound, onEvent } = setupPlayback()
    player.start(build([branch()]), 0)
    player.update(100)
    vi.advanceTimersByTime(5000)
    player.update(100)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    expect(playSound).toHaveBeenCalledOnce()
    expect(onEvent).toHaveBeenCalledOnce()
    player.stop()
  })

  it('描画が長く止まった後は過去の音を鳴らさず、コンボ・LED・ホールドを復元する', () => {
    const { player, elements, playSound, onPastEvent } = setupPlayback()
    player.start(build([branch(), note({ type: 96, position: 1, option: ['255', '0', '0'] })]), 0)
    player.update(600)
    expect(playSound).not.toHaveBeenCalled()
    expect(onPastEvent).toHaveBeenCalledTimes(2)
    expect(onPastEvent.mock.calls[1][0]).toMatchObject({ color: 'rgb(255,0,0)' })
    expect(elements[1].classList.contains('-hold')).toBe(true)
    player.update(850)
    expect(playSound).toHaveBeenCalledOnce()
    expect(elements[1].classList.contains('-hold')).toBe(false)
  })

  it('指定小節の頭ちょうどのイベントも1回再生する', () => {
    const { player, playSound } = setupPlayback()
    player.start(build([note()]), 100, { includeStart: true })
    player.update(100)
    player.update(100)
    expect(playSound).toHaveBeenCalledOnce()
  })

  it('オフセットを戻して到達済みイベントを通過し直しても、音・コンボを再実行しない', () => {
    const { player, elements, playSound, onEvent, onPastEvent } = setupPlayback()
    player.start(build([branch()]), 0)
    player.update(100)
    player.update(350)
    expect(playSound).toHaveBeenCalledTimes(2)
    player.seek(50)
    expect(elements[1].classList.contains('-hold')).toBe(false)
    player.update(100)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    player.update(350)
    expect(playSound).toHaveBeenCalledTimes(2)
    player.update(850)
    expect(playSound).toHaveBeenCalledTimes(3)
    expect(elements[1].classList.contains('-hold')).toBe(false)
    player.seek(500)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    player.update(850)
    expect(playSound).toHaveBeenCalledTimes(3)
    expect(onEvent).toHaveBeenCalledTimes(3)
    expect(onPastEvent).not.toHaveBeenCalled()
  })

  it('オフセット変更で飛び越えたイベントは状態だけ反映し、LEDも新しい位置へ戻す', () => {
    const { player, elements, playSound, onPastEvent, onSeek } = setupPlayback()
    player.start(build([branch(), note({ type: 96, position: 1, option: ['255', '0', '0'] })]), 0)
    player.seek(600)
    expect(onPastEvent).toHaveBeenCalledTimes(2)
    expect(playSound).not.toHaveBeenCalled()
    expect(onSeek).toHaveBeenLastCalledWith('rgb(255,0,0)')
    expect(elements[1].classList.contains('-hold')).toBe(true)
    player.seek(50)
    expect(onSeek).toHaveBeenLastCalledWith(null)
    expect(elements[1].classList.contains('-hold')).toBe(false)
    player.update(100)
    player.update(350)
    expect(onPastEvent).toHaveBeenCalledTimes(2)
    expect(playSound).not.toHaveBeenCalled()
    expect(onSeek).toHaveBeenLastCalledWith('rgb(255,0,0)')
    player.update(850)
    expect(playSound).toHaveBeenCalledOnce()
  })

  it('停止で発光と予約イベントを解除し、再再生に古い終了タイマーを持ち越さない', () => {
    const { elements, player, playSound, onEvent, advance } = setupPlayback()
    player.start(build([branch()]), 0)
    advance(100)
    expect(elements[1].classList.contains('-on')).toBe(true)
    player.stop()
    expect(elements[1].className).toBe('')
    expect(vi.getTimerCount()).toBe(0)
    advance(100)
    player.start(build([branch()]), 0)
    advance(650)
    expect(elements[1].classList.contains('-hold')).toBe(true)
    advance(200)
    expect(elements[1].classList.contains('-hold')).toBe(false)
    expect(playSound).toHaveBeenCalledTimes(4)
    expect(onEvent).toHaveBeenCalledTimes(4)
  })

  it.each([
    [false, false, 0], [false, true, 0], [true, false, 1], [true, true, 3],
  ])('打鍵音=%s・終点音=%s の条件に従い二重再生しない', (sound, endSound, expected) => {
    const { player, playSound, advance } = setupPlayback({ beam: false, sound, endSound })
    player.start(build([branch()]), 0)
    advance(1000)
    expect(playSound).toHaveBeenCalledTimes(expected)
  })

  it.each([false, true])('終点音=%sでも通常中点は鳴り、type89の末端は無音になる', endSound => {
    const { player, playSound, advance } = setupPlayback({ beam: true, sound: true, endSound })
    player.start(build([note({ type: 2, end: [
      note({ position: 1, end: [note({ type: 89, position: 3 })] }),
    ] })]), 0)
    advance(1000)
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
    player.update(100)
    player.update(850)
    expect(playSound).toHaveBeenCalledTimes(2)
  })

  it('現在の丸め方とDOM存在確認を維持し、範囲外でも例外にならない', () => {
    const elements = Array.from({ length: 6 }, () => document.createElement('div'))
    const beams = createKeybeamController(() => elements)
    expect(() => {
      for (const lane of [0, 1.5, 6, -100, 99, NaN]) {
        beams.pulse(lane)
        beams.setHolds([lane])
      }
    }).not.toThrow()
    beams.setHolds([0, 1.5, 6, -100, 99, NaN])
    expect(elements[0].classList.contains('-hold')).toBe(true)
    expect(elements[2].classList.contains('-hold')).toBe(true)
    beams.setHolds([])
    vi.runAllTimers()
    expect(elements.every(element => element.className === '')).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
