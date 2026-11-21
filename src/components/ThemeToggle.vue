<template>
  <v-btn
    color="primary"
    variant="outlined"
    :prepend-icon="isDarkTheme ? 'mdi-weather-night' : 'mdi-white-balance-sunny'"
    aria-label="ダークモード"
    :aria-pressed="isDarkTheme"
    @click="toggleTheme"
  >
    ダークモード: {{ isDarkTheme ? 'オン' : 'オフ' }}
  </v-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import { saveThemePreference } from '../composables/useThemePreference'

const theme = useTheme()
const isDarkTheme = computed(() => theme.name.value === 'dark')

function toggleTheme() {
  const next = isDarkTheme.value ? 'light' : 'dark'
  theme.change(next)
  saveThemePreference(next)
}
</script>
