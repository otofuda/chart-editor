import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import 'vuetify/styles'
import { loadThemePreference } from '../composables/useThemePreference'

export default createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  theme: {
    defaultTheme: loadThemePreference(),
    themes: {
      light: {
        colors: {
          'editor-panel': '#f0f0f0',
          'editor-highlight': '#ffffc0',
          'graph-peak': '#c51436',
          'graph-accent': '#b44700',
        },
      },
      dark: {
        colors: {
          'editor-panel': '#1c1c1c',
          'editor-highlight': '#514817',
          'graph-peak': '#ff7088',
          'graph-accent': '#ffb74d',
        },
      },
    },
  },
  defaults: {
    VCard: {
      rounded: 'lg'
    },
    VList: {
      rounded: 'lg',
    },
    VBtn: {
      rounded: 'lg'
    }
  }
})
