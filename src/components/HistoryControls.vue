<template>
  <div class="history-controls my-3">
    <div class="d-flex flex-wrap ga-2">
      <v-btn
        data-testid="undo"
        color="primary"
        :disabled="!history.canUndo.value"
        :title="undoTitle"
        prepend-icon="mdi-undo"
        variant="text"
        size="small"
        @click="$emit('undo')"
      >
        元に戻す
      </v-btn>
      <v-btn
        data-testid="redo"
        color="primary"
        :disabled="!history.canRedo.value"
        :title="redoTitle"
        prepend-icon="mdi-redo"
        variant="text"
        size="small"
        @click="$emit('redo')"
      >
        やり直す
      </v-btn>
      <v-btn
        :aria-expanded="isOpen"
        aria-controls="chart-history"
        color="primary"
        prepend-icon="mdi-history"
        variant="tonal"
        size="small"
        @click="isOpen = !isOpen"
      >
        操作履歴
      </v-btn>
    </div>
    <v-card
      v-if="isOpen"
      id="chart-history"
      class="mx-auto history-log"
      elevation="2"
      rounded="lg"
      title="操作履歴"
    >
      <template #prepend>
        <v-btn
          icon="mdi-close"
          variant="text"
          aria-label="操作履歴を閉じる"
          @click="isOpen = false"
        />
      </template>

      <v-list subheader aria-label="操作履歴">
        <v-list-item v-if="history.entries.value.length === 0">
          操作履歴はありません
        </v-list-item>
        <v-list-item v-else-if="history.cursor.value === 0" role="status">
          現在位置：開始状態
        </v-list-item>
        <v-list-item
          v-for="{ entry, position } in reversedEntries"
          :key="entry.id"
          :class="{ 'history-undone': position > history.cursor.value }"
          :aria-current="position === history.cursor.value ? 'step' : undefined"
        >
          <p class="mb-2 d-flex">
            <v-chip class="flex-shrink-0 mr-2" label>
              {{ difficultyLabel(entry) }}
            </v-chip>
            {{ entry.label }}
          </p>
          <v-list-item-subtitle>
            {{ entry.date.toLocaleString('ja-JP') }}
          </v-list-item-subtitle>
          <template #append>
            <v-chip
              v-if="position === history.cursor.value"
              size="small"
              color="primary"
            >
              現在位置
            </v-chip>
            <v-chip
              v-else-if="position > history.cursor.value"
              size="small"
            >
              取り消し済み
            </v-chip>
          </template>
        </v-list-item>
      </v-list>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChartHistory, HistoryEntry } from '../composables/useChartHistory'
import { shortcutKeys } from '../composables/useEditorShortcuts'

const props = defineProps<{ history: ChartHistory }>()

defineEmits<{
  undo: []
  redo: []
}>()

/** 親画面と開閉状態を共有し、メッセージログとの重なりを防ぐ。 */
const isOpen = defineModel<boolean>('open', { default: false })

/**
 * 幅の限られたログパネルのチップに表示する、対象難易度のラベルを返す。
 *
 * @param entry - 対象難易度を含む操作履歴
 * @returns 譜面情報・全難易度、または対象難易度の一覧
 */
function difficultyLabel(entry: HistoryEntry): string {
  if (entry.difficulties.length === 0) {
    return '譜面情報'
  }

  if (entry.difficulties.length === 5) {
    return '全難易度'
  }

  return entry.difficulties.join(' / ').toUpperCase()
}

/** 履歴上の位置を維持したまま、新しい操作から順に一覧へ表示する。 */
const reversedEntries = computed(() => (
  props.history.entries.value
    .map((entry, index) => ({ entry, position: index + 1 }))
    .reverse()
))

/** 取り消す操作名と対応するショートカットをボタンの補足へ表示する。 */
const undoTitle = computed(() => {
  const entry = props.history.entries.value[props.history.cursor.value - 1]

  return `${entry?.label ?? '元に戻す'} (${shortcutKeys('undo')})`
})

/** やり直す操作名と対応するショートカットをボタンの補足へ表示する。 */
const redoTitle = computed(() => {
  const entry = props.history.entries.value[props.history.cursor.value]

  return `${entry?.label ?? 'やり直す'} (${shortcutKeys('redo')})`
})
</script>

<style scoped>
.history-undone {
  opacity: 0.55;
}
</style>
