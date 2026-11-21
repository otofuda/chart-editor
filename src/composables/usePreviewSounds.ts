/** 短い補助音は一度デコードし、発音のたびにメディアをシークしない。 */
export function createPreviewSounds(url: string, offset = 0) {
  let context: AudioContext | undefined
  let buffer: AudioBuffer | undefined
  let loading: Promise<AudioBuffer> | undefined
  let disposed = false
  const controller = new AbortController()
  const voices = new Set<AudioBufferSourceNode>()

  async function prepare() {
    if (disposed) throw new DOMException('補助音の再生を終了しました', 'AbortError')
    if (typeof AudioContext === 'undefined') throw new Error('このブラウザーは補助音の再生に対応していません')
    context ??= new AudioContext({ latencyHint: 'interactive' })
    const audioContext = context
    // ユーザーの再生操作中に呼び出す。fetchの完了後では自動再生制限にかかる。
    const resumed = audioContext.state === 'running' ? Promise.resolve() : audioContext.resume()
    if (!loading) {
      loading = fetch(url, { signal: controller.signal })
        .then(response => {
          if (!response.ok) throw new Error('補助音を読み込めませんでした')
          return response.arrayBuffer()
        })
        .then(data => {
          if (disposed) throw new DOMException('補助音の再生を終了しました', 'AbortError')
          return audioContext.decodeAudioData(data)
        })
        .catch(error => { loading = undefined; throw error })
    }
    const [decoded] = await Promise.all([loading, resumed])
    if (disposed) throw new DOMException('補助音の再生を終了しました', 'AbortError')
    if (audioContext.state !== 'running') throw new Error('補助音を再生開始できませんでした')
    buffer = decoded
  }

  function play() {
    if (disposed || !buffer || context?.state !== 'running') return
    const voice = context.createBufferSource()
    voice.buffer = buffer
    voice.connect(context.destination)
    voices.add(voice)
    voice.onended = () => {
      voices.delete(voice)
      voice.disconnect()
    }
    voice.start(0, offset)
  }

  function stop() {
    voices.forEach(voice => {
      voice.onended = null
      voice.stop()
      voice.disconnect()
    })
    voices.clear()
  }

  function dispose() {
    if (disposed) return
    disposed = true
    stop()
    controller.abort()
    buffer = undefined
    if (context) void context.close().catch(() => {})
  }

  return { prepare, play, stop, dispose }
}
