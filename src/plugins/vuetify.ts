import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import 'vuetify/styles'

export default createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  theme: {
    defaultTheme: 'light',
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
