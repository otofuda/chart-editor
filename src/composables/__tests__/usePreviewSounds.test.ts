import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPreviewSounds } from '../usePreviewSounds'
import { FakeAudioContext } from './fakeAudioContext'

const fetchSound = vi.fn()
beforeEach(() => {
  FakeAudioContext.instances = []
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('fetch', fetchSound)
  fetchSound.mockReset().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })
})
afterEach(() => vi.unstubAllGlobals())

describe('デコード済みのプレビュー補助音', () => {
  it('ユーザー操作中にresumeし、デコード完了までは発音しない', async () => {
    const sounds = createPreviewSounds('/guide.mp3', 0.1)
    let resolve!: (response: unknown) => void
    fetchSound.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const pending = sounds.prepare()
    const context = FakeAudioContext.instances[0]
    expect(context.options).toEqual({ latencyHint: 'interactive' })
    expect(context.resume).toHaveBeenCalledOnce()
    sounds.play()
    expect(context.sources).toHaveLength(0)
    resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })
    await pending
    sounds.play()
    expect(context.sources[0].start).toHaveBeenCalledWith(0, 0.1)
    sounds.dispose()
  })

  it('同時準備と再再生で音源を再利用し、中断されたContextだけ再開する', async () => {
    const sounds = createPreviewSounds('/guide.mp3')
    await Promise.all([sounds.prepare(), sounds.prepare()])
    const context = FakeAudioContext.instances[0]
    sounds.play()
    sounds.stop()
    context.state = 'suspended'
    await sounds.prepare()
    sounds.play()
    expect(fetchSound).toHaveBeenCalledOnce()
    expect(context.decodeAudioData).toHaveBeenCalledOnce()
    expect(FakeAudioContext.instances).toHaveLength(1)
    expect(context.sources[1].buffer).toBe(context.sources[0].buffer)
    expect(context.state).toBe('running')
    sounds.dispose()
  })

  it('密集したノートにも個別に発音し、終了・停止で接続を解放する', async () => {
    const sounds = createPreviewSounds('/guide.mp3', 0.1)
    await sounds.prepare()
    const context = FakeAudioContext.instances[0]
    for (let i = 0; i < 24; i++) sounds.play()
    expect(context.sources).toHaveLength(24)
    for (const source of context.sources) {
      expect(source.buffer).toBe(context.decoded)
      expect(source.connect).toHaveBeenCalledWith(context.destination)
      expect(source.start).toHaveBeenCalledOnce()
      expect(source.stop).not.toHaveBeenCalled()
    }
    context.sources[0].onended!()
    expect(context.sources[0].disconnect).toHaveBeenCalledOnce()
    sounds.stop()
    sounds.stop()
    expect(context.sources[0].stop).not.toHaveBeenCalled()
    for (const source of context.sources.slice(1)) {
      expect(source.stop).toHaveBeenCalledOnce()
      expect(source.disconnect).toHaveBeenCalledOnce()
      expect(source.onended).toBeNull()
    }
    sounds.dispose()
  })

  it.each(['fetch', 'decode'])('%sの失敗後も再操作で準備できる', async step => {
    const sounds = createPreviewSounds('/guide.mp3')
    // 最初の呼び出しでContextを確保し、失敗を仕込んでから非同期処理を進める。
    if (step === 'fetch') fetchSound.mockResolvedValueOnce({ ok: false })
    const pending = sounds.prepare()
    const context = FakeAudioContext.instances[0]
    if (step === 'decode') context.decodeAudioData.mockRejectedValueOnce(new Error('decode'))
    await expect(pending).rejects.toThrow()
    sounds.play()
    expect(context.sources).toHaveLength(0)
    await sounds.prepare()
    sounds.play()
    expect(context.sources).toHaveLength(1)
    sounds.dispose()
  })

  it('resumeの拒否から再操作でき、デコード済み音源も再利用する', async () => {
    const sounds = createPreviewSounds('/guide.mp3')
    await sounds.prepare()
    const context = FakeAudioContext.instances[0]
    context.state = 'suspended'
    context.resume.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
    await expect(sounds.prepare()).rejects.toMatchObject({ name: 'NotAllowedError' })
    sounds.play()
    expect(context.sources).toHaveLength(0)
    await sounds.prepare()
    sounds.play()
    expect(context.sources).toHaveLength(1)
    expect(fetchSound).toHaveBeenCalledOnce()
    expect(context.decodeAudioData).toHaveBeenCalledOnce()
    sounds.dispose()
  })

  it('アンマウント後にデコードが完了しても発音せず、読み込みとContextを解放する', async () => {
    const sounds = createPreviewSounds('/guide.mp3')
    let resolve!: (response: unknown) => void
    fetchSound.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const pending = sounds.prepare()
    sounds.dispose()
    sounds.dispose()
    resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await expect(sounds.prepare()).rejects.toMatchObject({ name: 'AbortError' })
    sounds.play()
    const context = FakeAudioContext.instances[0]
    expect(context.sources).toHaveLength(0)
    expect(context.close).toHaveBeenCalledOnce()
    expect(fetchSound.mock.calls[0][1].signal.aborted).toBe(true)
  })
})
