<!-- eslint-disable vue/no-mutating-props -->
<template>
  <v-menu
    v-model="menu"
    :close-on-content-click="false"
    stick-to-target
    :max-width="240"
    :target="menuTarget"
    :location-strategy="locationStrategy"
  >
    <template v-slot:activator="{ props }">
      <!-- 音符を描画 -->
      <span
        class="note"
        :class="{
          [`type${drawType}`]: true,
          isDummy: note.type === 90,
          hidden: isHiddenControl,
          'note-draggable': noteDrag?.enabled.value && canDragNote(note),
          menu
        }"
        :style="{
          left: `${positionLeft}px`,
          bottom: `${positionBottom}px`,
          width: `${noteWidth}px`,
          background: dispColor
        }"
        v-bind="props"
        :ref="element => setMotionElement(element, props.ref)"
        @pointerdown="noteDrag?.start($event, note)"
        @click="rememberMenuTarget"
        @keydown="rememberMenuTarget"
      >
        <!-- テクスチャの時 -->
        <img
          v-if="drawType === 94"
          ref="textureElement"
          :src="
            String(drawOptions[0]).startsWith('texture')
            ? `https://db.otofuda.com/${drawOptions[0]}`
            : drawOptions[0]
          "
          :style="{
            height: `${measure.measureHeight * Number(drawOptions[2])}px`
          }"
          alt="texture"
          :draggable="false"
        />

        <!-- コメントの時 -->
        <v-icon v-if="drawType === 100" color="warning" class="mt-2">
          mdi-comment
        </v-icon>
        <v-textarea
          variant="outlined"
          v-if="drawType === 100"
          v-model="note.option[0]"
          v-history-field="field('コメントを変更')"
          class="elevation-4"
          bg-color="editor-highlight"
          hide-details
          @click.stop
        ></v-textarea>

        <input
          type="checkbox"
          v-model="note.isSelected"
          :id="String(note.index)"
          @click.stop
        />

        <v-tooltip v-if="getDuplicated" bottom>
          <template v-slot:activator="{ props }">
            <v-icon color="warning" dark v-bind="props" class="mt-2">
              mdi-alert
            </v-icon>
          </template>
          <span>{{ getDuplicated }}個の重複</span>
        </v-tooltip>

        <v-tooltip v-if="otofudaWarning" bottom>
          <template v-slot:activator="{ props }">
            <v-icon color="warning" dark v-bind="props" class="mt-2" :aria-label="otofudaWarning">
              mdi-alert
            </v-icon>
          </template>
          <span>{{ otofudaWarning }}</span>
        </v-tooltip>

        <v-tooltip v-if="getError" bottom>
          <template v-slot:activator="{ props }">
            <v-icon color="error" dark v-bind="props" class="mt-2">
              mdi-alert-circle-outline
            </v-icon>
          </template>
          <span>{{ getError }}</span>
        </v-tooltip>

        <strong v-if="noteSpeed !== 1" class="speed">x{{ noteSpeed }}</strong>
        <strong v-if="noteOrbit !== 0" class="orbit">&gt;{{ noteOrbit }}</strong>

        <strong v-if="drawType === 97">BEAT {{ note.option[0] }}</strong>
        {{ note.position }}/{{ note.split }}
        <strong v-if="drawType === 91">SpObj</strong>
        <strong v-if="drawType === 92">STOP</strong>
        <strong v-if="drawType === 93">WARP {{ note.option[0] }}</strong>
        <strong v-if="drawType === 98">BPM {{ note.option[0] }}</strong>
        <strong v-if="drawType === 99">EOF</strong>
      </span>
    </template>

    <!-- ポップアップ編集 -->
    <v-card v-if="menu">
      <v-list>
        <div @keydown="stopNumberInputArrowKeys">
        <v-list-item>
          <v-card-text>#{{ note.index }} {{ noteTypeName }}</v-card-text>
          <template #append>
            <v-btn size="small" icon="mdi-close" variant="text" @click="menu = false" />
          </template>
        </v-list-item>

        <v-list-item>
          <v-text-field
            v-model.number="localMeasure"
            v-history-field="field('小節番号を変更', applyMeasure, isMeasureDirty)"
            @change="commitMeasure"
            @keydown.enter.stop="menu = false"
            hide-details
            suffix="小節"
            variant="outlined"
            density="compact"
            type="number"
            min="0"
          ></v-text-field>
        </v-list-item>

        <v-list-item>
          <v-row class="mb-0 pt-2">
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="note.position"
                v-history-field="field('ノーツの位置を変更')"
                label="position"
                variant="outlined"
                density="compact"
                hide-details
                type="number"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="note.split"
                v-history-field="field('ノーツの分割数を変更')"
                label="split"
                variant="outlined"
                density="compact"
                hide-details
                type="number"
              ></v-text-field>
            </v-col>
          </v-row>
        </v-list-item>

        <v-list-item>
          LANE
          <v-spacer></v-spacer>
          <v-radio-group
            :model-value="note.lane"
            @update:model-value="value => change('ノーツのレーンを変更', () => note.lane = value)"
            inline
            hide-details
            :disabled="getIsLanelessNote"
            class="mt-0"
          >
            <v-radio v-for="n in 5" :key="n" :value="n"></v-radio>
          </v-radio-group>
        </v-list-item>

        <v-list-item>
          <v-select
            class="pt-2"
            :items="getNoteTypes"
            hide-details
            label="ノート種別"
            :model-value="note.type"
            @update:model-value="value => change('ノーツ種別を変更', () => note.type = value)"
            align="left"
            variant="outlined"
            density="compact"
          ></v-select>
        </v-list-item>

        <v-list-item v-if="getOptions.length > 0">
          <v-card-text>オプション</v-card-text>
          <template #append>
            <v-btn
              size="small"
              href="https://github.com/otofuda/chart-types"
              target="_blank"
              icon="mdi-help"
              variant="text"
            />
          </template>
        </v-list-item>

        <v-list-item v-for="(opt, i) in getOptions" :key="`option_${i}`">
          <v-text-field
            v-model="note.option[i]"
            v-history-field="field(`${opt.label}を変更`)"
            hide-details
            :label="opt.label"
            :type="opt.type"
            variant="solo-filled"
            density="compact"
          ></v-text-field>
        </v-list-item>
        </div>
      </v-list>

      <v-card-actions>
        <v-btn color="primary" variant="text" @click="cloneThisNote">
          <v-icon>mdi-content-copy</v-icon>
        </v-btn>
        <v-btn color="error" variant="text" @click="deleteThisNote" prepend-icon="mdi-delete">
          削除
        </v-btn>
        <v-btn color="secondary" variant="text" @click="showNoteInfo">
          <v-icon>mdi-information</v-icon>
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { computed, inject, ref, type ComponentPublicInstance } from 'vue'
import { stopNumberInputArrowKeys } from '@/composables/useNumberInputKeys'
import { type ExtendedNoteData, type Measure } from '@/types'
import { noteTypes, noteOptions } from '@/composables/useNoteTypes'
import { isDuplicated, hasError, isLanelessNote } from '@/composables/useNoteCheck'
import { deleteNotesKey, otofudaWarningKey, setAppendNoteInfoKey, showSnackbarKey } from '@/composables/injectionKeys'
import { useNoteMeasureEdit } from '@/composables/useNoteMeasureEdit'
import { useNoteMenuLocation } from '@/composables/useNoteMenuLocation'
import { noteDragKey } from '@/composables/useNoteDrag'
import { canDragNote } from '@/composables/noteMovement'
import { useHistoryFields, vHistoryField } from '@/composables/useHistoryField'
import {
  getNoteMotion,
  usePreviewMotionSource,
  type MotionSource,
} from '@/composables/usePreviewNoteMotion'

const props = defineProps<{
  note: ExtendedNoteData
  measure: Measure
  currentChart: ExtendedNoteData[]
}>()

const deleteNotes = inject(deleteNotesKey)!
const setAppendNoteInfo = inject(setAppendNoteInfoKey)!
const showSnackbar = inject(showSnackbarKey)!
const getOtofudaWarning = inject(otofudaWarningKey, () => false)
const noteDrag = inject(noteDragKey, null)

/** 個別の位置補正を適用するノーツ本体の要素。 */
const motionElement = ref<HTMLElement | null>(null)

/** speedに合わせて、下面を基準に拡縮するテクスチャ画像。 */
const textureElement = ref<HTMLImageElement | null>(null)

/**
 * 描画補正とVuetifyのメニューで、同じノーツ要素を共有する。
 * activatorのpropsにはrefも含まれるため、v-bindとは別に両方の参照を更新する。
 *
 * @param element マウント時のノーツ要素。アンマウント時にはnullを受け取る。
 * @param activatorRef Vuetifyがメニューのフォーカスや配置に使う参照の更新関数。
 */
function setMotionElement(
  element: Element | ComponentPublicInstance | null,
  activatorRef?: (element: Element | ComponentPublicInstance | null) => void,
) {
  motionElement.value = element instanceof HTMLElement ? element : null

  activatorRef?.(element)
}

/**
 * 現在のノーツ要素と補正前の座標を、個別描画のキャッシュへ提供する。
 * 小節内の縦位置を譜面全体の位置へ変換する。単独ノーツの横位置と幅は既存CSSに任せる。
 */
function collectMotionSource(): MotionSource {
  const modifiers = getNoteMotion(props.note)

  if (!modifiers || !motionElement.value) {
    return {}
  }

  return {
    nodes: [{
      element: motionElement.value,
      point: {
        ...modifiers,
        bottom: props.measure.measurePositionBottom + positionBottom.value,
        left: 0,
        width: 0,
      },
      texture: textureElement.value ? {
        element: textureElement.value,
        height: props.measure.measureHeight * Number(drawOptions.value[2]),
      } : undefined,
    }],
  }
}

// ここでは取得関数だけを登録し、個別描画が有効になるまで情報の生成を待つ。
usePreviewMotionSource(collectMotionSource)

const { history, field, change } = useHistoryFields()
const {
  menu,
  localMeasure,
  applyMeasure,
  commitMeasure,
  isMeasureDirty,
} = useNoteMeasureEdit(() => props.note, history)

const {
  menuTarget,
  locationStrategy,
  rememberMenuTarget,
} = useNoteMenuLocation(menu, 240)

function deleteThisNote() {
  deleteNotes(props.note.index)
  menu.value = false
}

function cloneThisNote() {
  setAppendNoteInfo({ ...props.note, option: [...props.note.option], end: [] })
  menu.value = false
  showSnackbar('挿入ノートに同じデータをセットしました')
}

function showNoteInfo() {
  showSnackbar(JSON.stringify(props.note, null, 2))
}

/** 描画用のノートタイプ(ダミー時は擬態対象) */
const drawType = computed(() => {
  if (props.note.type === 90) return Number(props.note.option[0])
  return props.note.type
})

/** 描画用のOption配列(ダミー時は[0]を削除したもの) */
const drawOptions = computed(() => {
  if (props.note.type === 90) return props.note.option.slice(1)
  return props.note.option
})

const positionLeft = computed(() => {
  // TAP, ロング, 区切り線, コメント
  if ([1, 2, 95, 100].includes(drawType.value)) return (props.note.lane - 1) * 60
  // 左右フリック, 上下フリック
  else if ([3, 4, 6, 7].includes(drawType.value)) {
    let _width = Number(drawOptions.value[0]) || 3
    if (_width === -1) _width = 3
    const _left = (props.note.lane - 1) * 60 + 30
    let _offset = 0
    const numer = Number(drawOptions.value[1]), denom = Number(drawOptions.value[2])
    if (numer && denom) _offset = (numer / denom) * 60
    return _left - (_width / 2) * 60 + _offset
  // テクスチャ
  } else if (drawType.value === 94) {
    let _width = Number(drawOptions.value[1]) || 1
    const _left = (props.note.lane - 1) * 60 + 30
    let _offset = 0
    if (drawOptions.value[3] && drawOptions.value[4]) _offset = (Number(drawOptions.value[3]) / Number(drawOptions.value[4])) * 60
    return _left - (_width / 2) * 60 + _offset
  // LED制御
  } else if (drawType.value === 96) return -50
  // 音札, その他特殊ノーツ
  else return 0
})

const positionBottom = computed(() => (props.note.position / props.note.split) * props.measure.measureHeight)

const noteWidth = computed(() => {
  // TAP, ロング, 終点, コメント
  if ([1, 2, 89, 100].includes(drawType.value)) return 60
  // 左右フリック, 上下フリック
  else if ([3, 4, 6, 7].includes(drawType.value)) {
    let _width = Number(drawOptions.value[0]) || 3
    if (_width === -1) _width = 3
    return 60 * _width
  // テクスチャ
  } else if (drawType.value === 94) {
    let _width = Number(drawOptions.value[1]) || 1
    return 60 * _width - 1
  // 区切り線
  } else if (drawType.value === 95) {
    let _width = Number(drawOptions.value[0]) || 1
    if (_width === -1) _width = 1
    if (props.note.position === 0) _width = 5
    return 60 * _width
  // LED制御
  } else if (drawType.value === 96) return 40
  // その他
  else return 300
})

const isHiddenControl = computed(() => drawType.value === 95 && props.note.position === 0)

const noteTypeName = computed(() => noteTypes.find(t => t.value === props.note.type)?.title || `不明 (type: ${props.note.type})`)

const dispColor = computed(() => {
  if (drawType.value === 96) {
    if (Number(drawOptions.value[0]) === -1 && Number(drawOptions.value[1]) === -1 && Number(drawOptions.value[2]) === -1) {
      return 'linear-gradient(0deg, #ff5151 20%, #44a5ff 80%)'
    } else return `rgb(${drawOptions.value[0]},${drawOptions.value[1]},${drawOptions.value[2]})`
  }
  return null
})

/** ノート種別ごとの定義に従って読み取った速度と軌道。 */
const noteMotion = computed(() => getNoteMotion(props.note))

/** 速度バッジの表示値。既定値（1）のときは非表示にする。 */
const noteSpeed = computed(() => noteMotion.value?.speed ?? 1)

/** 軌道バッジの表示値。既定値（0）のときは非表示にする。 */
const noteOrbit = computed(() => noteMotion.value?.orbit ?? 0)

const getDuplicated = computed(() => isDuplicated(props.note, props.currentChart, [], { checkPreAppend: false }))
const getError = computed(() => hasError(props.note))
const otofudaWarning = computed(() => getOtofudaWarning(props.note))
const getOptions = computed(() => noteOptions(props.note))
const getNoteTypes = computed(() => noteTypes)
const getIsLanelessNote = computed(() => isLanelessNote(props.note))
</script>

<style lang="scss" scoped>
.v-card {
  &__text {
    padding: 0;
    text-align: left;
  }
  .v-input {
    &--radio-group__input .v-radio {
      margin: 0;
    }
  }
}
</style>
