import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { useChartData } from '../useChartData'
import { useFileIO } from '../useFileIO'
import { ControlledFileReader } from './controlledFileReader'

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

describe('ファイル変更時の再生停止と読み込みの競合', () => {
  beforeEach(() => {
    ControlledFileReader.instances = []
    vi.stubGlobal('FileReader', ControlledFileReader)
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  function setupChange() {
    const chartData = useChartData()
    const beforeChange = vi.fn()
    const showSnackbar = vi.fn()
    const io = useFileIO(chartData, showSnackbar, beforeChange)
    const text = (bpm = 180) => JSON.stringify({ ...chartData.chartObject.value, info: { bpm, beat: 4, offset: 0, version: 2 } })
    return { chartData, beforeChange, showSnackbar, io, text }
  }

  it('ファイル選択直後と、読み込み結果を適用する前に再生を止める', () => {
    const s = setupChange()
    s.io.readFile(new File([''], 'next.json'))
    expect(s.beforeChange).toHaveBeenCalledOnce()
    expect(s.chartData.chartObject.value.info.bpm).toBe(120)
    s.beforeChange.mockImplementation(() => expect(s.chartData.chartObject.value.info.bpm).toBe(120))
    ControlledFileReader.instances[0].complete(s.text())
    expect(s.beforeChange).toHaveBeenCalledTimes(2)
    expect(s.chartData.chartObject.value.info.bpm).toBe(180)
    expect(s.io.isLoaded.value).toBe(true)
  })

  it('読み込み時にinfoと編集情報を正規化し、LNのcurveとwidthを保持する', () => {
    const s = setupChange()
    const end = { type: 89, lane: 2, measure: 1, position: 0, split: 4, option: ['1', '0', 'ease', '2'], end: [] }
    const hold = { index: 8, isSelected: true, type: 2, lane: 1, measure: 0, position: 0, split: 4, option: ['1', '0'], end: [end] }
    const raw = {
      info: { bpm: 180, offset: 250 },
      easy: [hold, { type: 1, lane: 3, measure: 1, position: 1, split: 4, option: [], end: [] }],
    }
    s.io.readFile(new File([''], 'partial.json'))
    s.beforeChange.mockImplementation(() => expect(s.chartData.chartObject.value.info.bpm).toBe(120))
    ControlledFileReader.instances[0].complete(JSON.stringify(raw))
    const loaded = s.chartData.chartObject.value
    expect(s.beforeChange).toHaveBeenCalledTimes(2)
    expect(loaded.info).toEqual({ version: 2, bpm: 180, beat: 4, offset: 250 })
    expect(loaded.easy[0]).toEqual({ ...hold, isSelected: false })
    expect(loaded.easy[1]).toEqual({ ...raw.easy[1], index: 1, isSelected: false })
    for (const difficulty of ['raku', 'normal', 'hard', 'extra'] as const) expect(loaded[difficulty]).toEqual([])
    expect(s.io.isLoaded.value).toBe(true)
  })

  it('正規化中のエラーでも現在の譜面を維持し、次の読み込みを妨げない', () => {
    const s = setupChange()
    const original = s.chartData.chartObject.value
    s.io.readFile(new File([''], 'invalid-notes.json'))
    ControlledFileReader.instances[0].complete(JSON.stringify({ easy: {} }))
    expect(s.chartData.chartObject.value).toBe(original)
    expect(s.beforeChange).toHaveBeenCalledOnce()
    expect(s.showSnackbar).toHaveBeenCalledWith(expect.stringContaining('読み込めませんでした'))
    expect(s.io.isLoaded.value).toBe(false)
    s.io.readFile(new File([''], 'retry.json'))
    ControlledFileReader.instances[1].complete(JSON.stringify({ info: { bpm: 220 } }))
    expect(s.chartData.chartObject.value.info).toEqual({ version: 2, bpm: 220, beat: 4, offset: 0 })
    expect(s.io.isLoaded.value).toBe(true)
  })

  it('番号が重複した譜面を読み込んでLEDを削除しても他のノーツは残る', () => {
    const s = setupChange()
    const tap = { index: 1, type: 1, lane: 1, measure: 0, position: 0, split: 8, option: [], end: [] }
    const led = { ...tap, type: 96, lane: -1, measure: 1, option: ['255', '0', '0'] }
    s.io.readFile(new File([''], 'duplicate-index.json'))
    ControlledFileReader.instances[0].complete(JSON.stringify({ easy: [tap, led] }))

    expect(s.io.isLoaded.value).toBe(true)
    expect(s.chartData.currentChart.value).toHaveLength(2)
    s.chartData.deleteNotes(s.chartData.currentChart.value.find(note => note.type === 96)!.index!)

    expect(s.chartData.currentChart.value).toEqual([{ ...tap, isSelected: false }])
  })

  it('連続選択では前の読み込みを中断し、遅いload通知も新しい譜面を上書きしない', () => {
    const s = setupChange()
    s.io.readFile(new File([''], 'first.json'))
    const first = ControlledFileReader.instances[0]
    const queuedLoad = first.onload
    expect(() => s.io.readFile(new File([''], 'second.json'))).not.toThrow()
    expect(first.abort).toHaveBeenCalledOnce()
    ControlledFileReader.instances[1].complete(s.text(200))
    first.complete(s.text(150), queuedLoad)
    expect(s.chartData.chartObject.value.info.bpm).toBe(200)
    expect(s.io.fileName.value).toBe('second.json')
    expect(s.beforeChange).toHaveBeenCalledTimes(3)
  })

  it.each(['clear', 'new'])('%sで読み込みを取り消すと、遅いload通知を適用しない', action => {
    const s = setupChange()
    s.io.readFile(new File([''], 'first.json'))
    const reader = ControlledFileReader.instances[0]
    const queuedLoad = reader.onload
    if (action === 'new') s.io.newFile()
    else s.io.readFile(null)
    expect(reader.abort).toHaveBeenCalledOnce()
    reader.complete(s.text(300), queuedLoad)
    expect(s.chartData.chartObject.value.info.bpm).toBe(120)
    expect(s.beforeChange).toHaveBeenCalledTimes(2)
  })

  it('不正なJSONでも前の譜面を維持し、エラーを通知して再生は再開しない', () => {
    const s = setupChange()
    s.io.readFile(new File([''], 'broken.json'))
    expect(() => ControlledFileReader.instances[0].complete('{')).not.toThrow()
    expect(s.chartData.chartObject.value.info.bpm).toBe(120)
    expect(s.beforeChange).toHaveBeenCalledOnce()
    expect(s.showSnackbar).toHaveBeenCalledWith(expect.stringContaining('読み込めませんでした'))
  })

  it('読み込みエラーを通知した後も次のファイルを読み込める', () => {
    const s = setupChange()
    s.io.readFile(new File([''], 'failed.json'))
    ControlledFileReader.instances[0].onerror!()
    expect(s.showSnackbar).toHaveBeenCalledOnce()
    s.io.readFile(new File([''], 'retry.json'))
    ControlledFileReader.instances[1].complete(s.text(220))
    expect(s.chartData.chartObject.value.info.bpm).toBe(220)
  })

  it('音源ファイルもsrcを書き換える前にプレビューを終了する', () => {
    const s = setupChange()
    const originalSource = s.io.previewAudio.value.src
    s.beforeChange.mockImplementation(() => expect(s.io.previewAudio.value.src).toBe(originalSource))
    vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:next-track') })
    s.io.readAudioFile(new File([''], 'next.wav'))
    expect(s.beforeChange).toHaveBeenCalledOnce()
    expect(s.io.previewAudio.value.src).toBe('blob:next-track')
  })
})
