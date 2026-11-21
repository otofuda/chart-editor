// 通常の時刻ジッターは許容し、再同期でスクロール速度を急に変えない。
const DRIFT_TOLERANCE_MS = 8
const MAX_CORRECTION_RATE = 0.02
const DISCONTINUITY_MS = 250
const STALE_SAMPLE_MS = 250

/**
 * currentTimeは表示フレームごとに更新されるとは限らない。
 * 音声時刻を基準に単調増加時計で補間し、新しいサンプルで少しずつ補正する。
 */
export function createPreviewClock() {
  let initialized = false
  let rendered = 0
  let lastMedia = 0
  let lastWall = 0
  let lastChange = 0
  let lastRate = 1

  return {
    reset() { initialized = false },
    read(media: number, wall: number, { running = true, playbackRate = 1 } = {}) {
      const anchor = () => {
        initialized = true
        rendered = lastMedia = media
        lastWall = lastChange = wall
        lastRate = playbackRate
        return rendered
      }
      if (!initialized || !running || playbackRate <= 0 || playbackRate !== lastRate) return anchor()

      const elapsed = Math.max(0, wall - lastWall)
      const predicted = rendered + elapsed * playbackRate
      if (media !== lastMedia) {
        // シークや長い描画停止からの復帰では、補間を引き継がず実時刻へ合わせる。
        if (media < lastMedia || Math.abs(media - predicted) > DISCONTINUITY_MS) return anchor()
        const drift = media - predicted
        const limit = elapsed * playbackRate * MAX_CORRECTION_RATE
        const correction = Math.abs(drift) > DRIFT_TOLERANCE_MS ? Math.max(-limit, Math.min(limit, drift)) : 0
        rendered = predicted + correction
        lastMedia = media
        lastChange = wall
      } else if (wall - lastChange > STALE_SAMPLE_MS) {
        // waiting通知を受け取れない場合も、停止した音源から進み続けない。
        rendered = media
      } else {
        rendered = predicted
      }
      lastWall = wall
      return rendered
    },
  }
}
