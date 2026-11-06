import { describe, expect, it } from 'vitest'
import { createPreviewClock } from '../usePreviewClock'

describe('音声時刻のフレーム補間', () => {
  it.each([2, 16, 33, 50, 100].flatMap(quantum => [60, 120].map(fps => [quantum, fps])))(
    '音声時刻が%sms刻みでも、%sfpsの各フレームで滑らかに前進する', (quantum, fps) => {
      const clock = createPreviewClock()
      const period = 1000 / fps
      let previous = clock.read(0, 0)
      for (let frame = 1; frame <= fps * 10; frame++) {
        const wall = frame * period
        const media = Math.floor(wall / quantum) * quantum
        const time = clock.read(media, wall)
        const advance = time - previous
        expect(advance).toBeGreaterThanOrEqual(period * 0.979)
        expect(advance).toBeLessThanOrEqual(period * 1.021)
        expect(Math.abs(time - wall)).toBeLessThan(20)
        previous = time
      }
    },
  )

  it('音声時計と単調増加時計に差があっても、10分間ズレを蓄積しない', () => {
    const clock = createPreviewClock()
    clock.read(0, 0)
    for (let frame = 1; frame <= 60 * 600; frame++) {
      const wall = frame * 1000 / 60
      const actual = wall * 0.9995
      const media = Math.floor(actual / 33) * 33
      const time = clock.read(media, wall)
      expect(Math.abs(time - actual)).toBeLessThan(35)
    }
  })

  it('待機・一時停止中は時計を外挿せず、再開時には新しい音声位置から補間する', () => {
    const clock = createPreviewClock()
    clock.read(1000, 0)
    expect(clock.read(1000, 16)).toBe(1016)
    expect(clock.read(1000, 32, { running: false })).toBe(1000)
    expect(clock.read(1000, 5000, { running: false })).toBe(1000)
    clock.reset()
    expect(clock.read(1000, 5016)).toBe(1000)
    expect(clock.read(1000, 5032)).toBe(1016)
  })

  it('音声時刻が長時間更新されない場合も、際限なく先行しない', () => {
    const clock = createPreviewClock()
    clock.read(1000, 0)
    for (let wall = 16; wall <= 5000; wall += 16) clock.read(1000, wall)
    expect(clock.read(1000, 5016)).toBe(1000)
  })

  it('シーク・大きな不連続では元の位置から補間せず、即座に再同期する', () => {
    const clock = createPreviewClock()
    clock.read(1000, 0)
    expect(clock.read(5000, 16)).toBe(5000)
    expect(clock.read(200, 32)).toBe(200)
    clock.reset()
    expect(clock.read(300, 48)).toBe(300)
  })

  it('再生速度の変更に合わせて時計の進み方も変える', () => {
    const clock = createPreviewClock()
    clock.read(1000, 0)
    expect(clock.read(1000, 16, { playbackRate: 2 })).toBe(1000)
    expect(clock.read(1000, 32, { playbackRate: 2 })).toBe(1032)
    expect(clock.read(1000, 48, { playbackRate: 0 })).toBe(1000)
    expect(clock.read(1000, 64, { playbackRate: 0 })).toBe(1000)
  })
})
