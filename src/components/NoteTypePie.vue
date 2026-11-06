<template>
  <section class="note-type-pie pa-4" aria-labelledby="note-type-pie-title">
    <h3 id="note-type-pie-title" class="text-subtitle-1 mb-3">種類別ノーツの割合</h3>
    <VPie
      v-if="items.length"
      :key="items.map(item => item.key).join(',')"
      :items="items"
      :legend="{ position: 'right', textFormat: '[title] ([value])' }"
      tooltip
    />
    <p v-else>表示するノーツがありません</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { VPie } from 'vuetify/labs/VPie'
import { noteTypes } from '../composables/useNoteTypes'

const props = defineProps<{ typeCount: Record<number, number> }>()

const colors = ['#1976d2', '#7b1fa2', '#87cefa', '#f08080', '#ffd700', '#87f080', '#ec80f0']
const items = computed(() => noteTypes
  .filter(type => type.value >= 1 && type.value <= 7)
  .map((type, index) => ({
    key: type.value,
    title: type.title,
    value: props.typeCount[type.value] ?? 0,
    color: colors[index],
  }))
  .filter(item => item.value > 0))
</script>
