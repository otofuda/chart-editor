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

  it('保存JSONでoptionとendを正規化し、編集中の譜面は変更しない', async () => {
    const { chartData, fileIO } = setup()
    const base = { type: 1, lane: 1 as const, measure: 0, position: 0, split: 4, option: [], end: [] }
    const notes = [
      { ...base, type: 98, option: ['120'], end: [{ ...base }] },
      { ...base, type: 2, option: ['', '1.5'], end: [
        { ...base, option: ['', '', 'ease'], end: [{ ...base, type: 89, option: ['', '', '', '2'] }] },
      ] },
    ]
    chartData.chartObject.value.normal = notes
    const original = JSON.stringify(chartData.chartObject.value)
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:test')
    vi.stubGlobal('URL', class extends URL { static createObjectURL = createObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    try {
      fileIO.saveFile()
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsText(createObjectURL.mock.calls[0][0])
      })
      const saved = JSON.parse(text)
      expect(saved.normal[0]).toMatchObject({ lane: -1, end: [] })
      expect(saved.normal[1].option).toEqual(['1', '1.5'])
      expect(saved.normal[1].end[0].option).toEqual(['1', '0', 'ease'])
      expect(saved.normal[1].end[0].end[0].option).toEqual(['1', '0', 'linear', '2'])
      expect(JSON.stringify(chartData.chartObject.value)).toBe(original)
    } finally {
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
    }
  })
})
