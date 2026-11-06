import { vi } from 'vitest'

export class FakeBufferSource {
  buffer: AudioBuffer | null = null
  onended: (() => void) | null = null
  connect = vi.fn()
  disconnect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

export class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  state: AudioContextState = 'suspended'
  destination = {}
  sources: FakeBufferSource[] = []
  decoded = { duration: 0.3 } as AudioBuffer
  resume = vi.fn(async () => { this.state = 'running' })
  close = vi.fn(async () => { this.state = 'closed' })
  decodeAudioData = vi.fn(async (_data: ArrayBuffer) => this.decoded)
  createBufferSource = vi.fn(() => {
    const source = new FakeBufferSource()
    this.sources.push(source)
    return source
  })
  constructor(public options?: AudioContextOptions) { FakeAudioContext.instances.push(this) }
}
