import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export type LayoutPreference = 'auto' | 'side-by-side' | 'stacked'
export type EditorLayout = Exclude<LayoutPreference, 'auto'>

/** 手動選択は保存せず、起動時には画面幅に応じたレイアウトを使う。 */
export function useEditorLayout() {
  const preference = ref<LayoutPreference>('auto')
  const narrow = ref(window.innerWidth < 768)
  const media = window.matchMedia?.('(width < 768px)')

  // matchMediaを使えない環境では、画面幅とresizeイベントで判定する。
  const update = () => {
    narrow.value = media ? media.matches : window.innerWidth < 768
  }

  update()

  onMounted(() => {
    if (media) {
      media.addEventListener('change', update)
    } else {
      window.addEventListener('resize', update)
    }
  })

  onBeforeUnmount(() => {
    media?.removeEventListener('change', update)
    window.removeEventListener('resize', update)
  })

  // 手動選択を優先し、「自動」の場合だけ768pxを境に切り替える。
  const layout = computed<EditorLayout>(() => {
    if (preference.value !== 'auto') {
      return preference.value
    }

    return narrow.value ? 'stacked' : 'side-by-side'
  })

  // 狭い画面で左右を指定した場合も、譜面は専用の領域内でスクロールする。
  const contained = computed(() => layout.value === 'stacked' || narrow.value)

  return { preference, layout, narrow, contained }
}
