import { vi } from 'vitest'

/** 中断直前にキューへ入ったload通知も、任意の順序で再現する。 */
export class ControlledFileReader {
  static readonly LOADING = 1
  static instances: ControlledFileReader[] = []
  readyState = 0
  result: string | null = null
  onload: ((event: { target: ControlledFileReader }) => void) | null = null
  onerror: (() => void) | null = null
  readAsText = vi.fn(() => {
    if (this.readyState === ControlledFileReader.LOADING) throw new DOMException('busy', 'InvalidStateError')
    this.readyState = ControlledFileReader.LOADING
  })
  abort = vi.fn(() => { this.readyState = 2 })

  constructor() { ControlledFileReader.instances.push(this) }

  complete(text: string, handler = this.onload) {
    this.result = text
    this.readyState = 2
    handler?.({ target: this })
  }
}
