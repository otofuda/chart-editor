import { ref } from 'vue'
import type { TextureObject, ExtendedNoteData } from '../types'

/**
 * テクスチャ DB の取得・適用を管理する composable
 * @param appendNote - 挿入ノートの ref
 * @param showSnackbar - スナックバー表示関数
 */
export function useTextureDB(
  appendNote: { value: ExtendedNoteData },
  showSnackbar: (message: string) => void
) {
  /** テクスチャ DB からの応答 */
  const texturePayload = ref<{ contents: TextureObject[] }>({ contents: [] })

  /** テクスチャの持つタブ一覧 */
  const textureTabs = ref<string[]>([])

  /** 現在選択中のタブ */
  const textureCurrentTab = ref<string | null>(null)

  /**
   * テクスチャ DB を取得してタブを生成する
   */
  function fetchTextures(): void {
    const endpoint = 'https://api.otofuda.com/contents/textures'

    fetch(endpoint)
      .then((res) => res.json())
      .then((data: { contents: TextureObject[] }) => {
        texturePayload.value = data
        // タブ一覧を生成 (重複除去)
        const tabs: string[] = []
        data.contents.forEach((obj: TextureObject) => {
          obj.tab.forEach((t) => {
            if (!tabs.includes(t)) tabs.push(t)
          })
        })
        textureTabs.value = tabs
        textureCurrentTab.value = tabs[0] ?? null
      })
      .catch(() => {
        // 外部 API への接続失敗は非致命的
      })
  }

  /**
   * テクスチャを appendNote の option にセットする
   * @param obj - セットするテクスチャオブジェクト
   */
  function setTexture(obj: TextureObject): void {
    const note = appendNote.value
    if (note.type === 94) {
      note.option[0] = obj.url
      note.option[1] = String(obj.width || note.option[1])
      showSnackbar(`テクスチャ「${obj.name}」をセットしました`)
    } else {
      showSnackbar('挿入中のノートがテクスチャではありません')
    }
  }

  return {
    texturePayload,
    textureTabs,
    textureCurrentTab,
    fetchTextures,
    setTexture,
  }
}
