export type ThemePreference = 'light' | 'dark'

const THEME_KEY = 'chart-editor__theme'

export function loadThemePreference(): ThemePreference {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function saveThemePreference(theme: ThemePreference): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // 保存できなくても、現在のセッションではテーマを切り替えられる。
  }
}
