import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useTextureDB } from '../useTextureDB'
import type { ExtendedNoteData } from '../../types'

describe('useTextureDB', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetchTextures で api.otofuda.com を X-API-KEY ヘッダー無しで呼び出す', async () => {
    const appendNote = ref<ExtendedNoteData>({
      type: 94,
      lane: 1,
      measure: 1,
      position: 0,
      split: 8,
      option: [],
      end: [],
    })
    const showSnackbar = vi.fn()
    const textureDB = useTextureDB(appendNote, showSnackbar)

    const mockResponse = {
      contents: [
        {
          id: 'tex1',
          name: 'Texture 1',
          tab: ['TabA', 'TabB'],
          url: 'texture/tex1.png',
          width: 1,
        },
        {
          id: 'tex2',
          name: 'Texture 2',
          tab: ['TabA'],
          url: 'texture/tex2.png',
          width: 2,
        },
      ],
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => mockResponse,
    } as Response)

    textureDB.fetchTextures()

    // 非同期処理の完了を待機
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchSpy).toHaveBeenCalledWith('https://api.otofuda.com/contents/textures')
    // ヘッダーに API キーが含まれていないことを検証 (fetchSpy の第2引数が渡されていないか、headers に X-API-KEY がない)
    const options = fetchSpy.mock.calls[0][1] as RequestInit | undefined
    expect((options?.headers as Record<string, string> | undefined)?.['X-API-KEY']).toBeUndefined()

    expect(textureDB.texturePayload.value.contents.length).toBe(2)
    expect(textureDB.textureTabs.value).toEqual(['TabA', 'TabB'])
    expect(textureDB.textureCurrentTab.value).toBe('TabA')
  })
})
