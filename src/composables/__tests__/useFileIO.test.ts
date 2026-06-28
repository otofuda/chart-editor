import { describe, it, expect, vi } from 'vitest'
import { useChartData } from '../useChartData'
import { useFileIO } from '../useFileIO'

function setup() {
  const chartData = useChartData()
  const showSnackbar = vi.fn()
  const fileIO = useFileIO(chartData, showSnackbar)
  return { chartData, fileIO, showSnackbar }
}

describe('useFileIO', () => {
  it('newFileを呼ぶとisLoadedがtrueになる', () => {
    const { fileIO } = setup()
    expect(fileIO.isLoaded.value).toBe(false)
    fileIO.newFile()
    expect(fileIO.isLoaded.value).toBe(true)
  })

  it('saveFileを呼ぶとaタグが作成される', () => {
    const { fileIO } = setup()
    const createElement = vi.spyOn(document, 'createElement')
    try {
      fileIO.saveFile()
    } catch {
      // jsdom環境ではclick()が例外になる場合がある
    }
    expect(createElement).toHaveBeenCalledWith('a')
    vi.restoreAllMocks()
  })

  it('readAudioFileにnullを渡しても例外が発生しない', () => {
    const { fileIO } = setup()
    expect(() => fileIO.readAudioFile(null)).not.toThrow()
  })

  it('fileNameの初期値が設定されている', () => {
    const { fileIO } = setup()
    expect(typeof fileIO.fileName.value).toBe('string')
  })
})
