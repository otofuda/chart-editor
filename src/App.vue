<template>
  <v-app id="app">
    <Preview
      :currentChart="currentChart"
      :currentDifficulty="currentDifficulty"
      :infoObject="chartInfo"
      :measureData="measureData"
      :audioVolume="audioVolume"
      :previewAudio="previewAudio"
      :appendNote="getAppendNote"
      :preAppendNotes="preAppendNotes"
      :isShowDetail="isShowDetail"
      :isCaptureMode="isCaptureMode"
      :isPreviewMode="isPreviewMode"
      :isImageMode="isImageMode"
    />

    <v-container fluid class="panel">
      <img
        src="https://otofuda.github.io/chart-editor/logo.png"
        alt="Otofuda Chart Editor V2"
        class="logo"
      />

      <h3>譜面ファイル</h3>

      <v-row>
        <v-file-input
          accept=".json, application/json"
          label="ファイルを選択"
          hide-details
          variant="outlined"
          density="compact"
          prepend-icon="mdi-folder"
          @update:model-value="readFile"
        ></v-file-input>
        <v-col>
          <v-select
            :items="difficulties"
            label="難易度"
            v-model="currentDifficulty"
            align="left"
            hide-details
            variant="outlined"
            density="compact"
            :menu-props="{}"
          ></v-select>
        </v-col>
      </v-row>

      <v-btn-group density="compact" class="difficulty-select">
        <v-btn size="small" theme="dark" color="blue" @click="currentDifficulty = 'raku'">
          RAKU
        </v-btn>
        <v-btn size="small" theme="dark" color="green" @click="currentDifficulty = 'easy'">
          EASY
        </v-btn>
        <v-btn size="small" theme="dark" color="orange" @click="currentDifficulty = 'normal'">
          NORMAL
        </v-btn>
        <v-btn size="small" theme="dark" color="#ff0984" @click="currentDifficulty = 'hard'">
          HARD
        </v-btn>
        <v-btn size="small" theme="dark" color="purple" @click="currentDifficulty = 'extra'">
          EXTRA
        </v-btn>
      </v-btn-group>

      <h3>ノートの挿入（仮配置：{{ preAppendNotes.length }}個）</h3>

      <v-checkbox
        v-model="isAppendMode"
        label="ノート挿入モード"
        density="compact"
        hide-details
        class="mb-2"
      />

      <v-card v-show="isAppendMode" style="margin: 0 -32px" class="pa-4" rounded="0">
        <v-row justify="space-between">
          <v-checkbox
            v-model="isAutoFollow"
            label="編集小節を自動追従"
            class="mt-0"
            hide-details
            density="compact"
          ></v-checkbox>
          <v-btn
            color="orange"
            size="small"
            variant="outlined"
            append-icon="mdi-plus-circle-outline"
            @click="appendSimultaneously(appendNote)"
          >
            このノートのみを全難易度に同時挿入
          </v-btn>
        </v-row>
        <v-row>
          <!-- Type -->
          <v-col cols="12" sm="3">
            <v-select
              :items="noteTypes"
              hide-details
              label="ノート種別"
              @update:model-value="changeAppendNoteType"
              v-model="appendNote.type"
              variant="outlined"
              density="compact"
            >
            </v-select>
          </v-col>
          <!-- Measure -->
          <v-col cols="12" sm="3">
            <v-text-field
              v-model.number="appendNote.measure"
              label="measure"
              variant="outlined"
              density="compact"
              hide-details
              type="number"
              min="0"
            ></v-text-field>
          </v-col>
          <!-- Position -->
          <v-col cols="12" sm="3">
            <v-text-field
              v-model.number="appendNote.position"
              label="position"
              variant="outlined"
              density="compact"
              hide-details
              min="0"
              :max="appendNote.split - 1"
              bg-color="#ffffc0"
              @keydown.enter="placeNotes(appendNote)"
              @keydown.left="appendNoteToLeft"
              @keydown.right="appendNoteToRight"
              @keydown.up="appendNoteToUp"
              @keydown.down="appendNoteToDown"
            ></v-text-field>
          </v-col>
          <!-- Split -->
          <v-col cols="12" sm="3">
            <v-combobox
              v-model.number="appendNote.split"
              :items="[4, 8, 16, 32, 12, 24, 48]"
              label="split"
              variant="outlined"
              hide-details
              density="compact"
              :menu-props="{}"
            ></v-combobox>
          </v-col>
        </v-row>

        <!-- オプション入力欄(汎用) -->
        <div
          v-for="(opt, i) in noteOptionsForAppendNote"
          :key="`option_${i}`"
          class="my-4"
        >
          <v-text-field
            v-model="appendNote.option[i]"
            hide-details
            :label="opt.label"
            :type="opt.type"
            append-outer-icon="mdi-help"
            variant="outlined"
            density="compact"
            @click:append-outer="
              showSnackbar(`${opt.label}の説明：${opt.desc}`)
            "
          ></v-text-field>
        </div>

        <!-- Type94 テクスチャ選択 -->
        <v-menu
          v-if="appendNote.type === 94"
          v-model="dialog.texture"
          :close-on-content-click="false"
          max-width="600"
          offset-overflow
        >
          <template v-slot:activator="{ props }">
            <v-btn color="indigo" variant="outlined" v-bind="props">
              テクスチャをデータベースから探す
            </v-btn>
          </template>

          <v-card rounded="lg">
            <v-tabs v-model="textureCurrentTab" show-arrows color="primary">
              <v-tab v-for="tabName in textureTabs" :key="tabName">
                {{ tabName }}
              </v-tab>
            </v-tabs>

            <v-window v-model="textureCurrentTab">
              <v-window-item
                v-for="tabName in textureTabs"
                :key="tabName"
                class="px-2"
              >
                <v-row>
                  <v-col
                    v-for="texture in texturePayload.contents.filter(tx =>
                      tx.tab.includes(tabName)
                    )"
                    :key="texture.id"
                    cols="12"
                    sm="6"
                    md="4"
                  >
                    <v-card rounded="lg" class="texture-card" elevation="2">
                      <v-img
                        :src="
                          texture.url.startsWith('texture')
                          ? `https://db.otofuda.com/${texture.url}`
                          : texture.url
                        "
                        height="100px"
                      >
                        <span class="texture-card__name">
                          {{ texture.name }}
                        </span>
                      </v-img>

                      <v-card-actions class="justify-end pa-0">
                        <v-btn
                          small
                          variant="text"
                          color="primary"
                          @click="setTexture(texture)"
                        >
                          これにする
                        </v-btn>
                      </v-card-actions>
                    </v-card>
                  </v-col>
                </v-row>
              </v-window-item>
            </v-window>
          </v-card>
        </v-menu>

        <!-- Type96 カラーピッカー -->
        <v-row v-if="appendNote.type === 96" class="pl-2">
          <v-color-picker
            v-model="appendNoteColorOption"
            :swatches="colorSwatches"
            show-swatches
            elevation="2"
            class="mr-4 mb-2"
            hide-inputs
          ></v-color-picker>
          <div>
            <div><strong>特殊な色を設定</strong></div>
            <v-btn
              variant="outlined"
              color="primary"
              @click="appendNote.option = ['-1', '-1', '-1']"
              class="my-2"
            >
              青赤(default)に戻す
            </v-btn>
            <p><code>['-1', '-1', '-1']</code> を設定します</p>
          </div>
        </v-row>

        <v-row>
          <v-radio-group
            v-model="appendNote.lane"
            inline
            :max-width="240"
            hide-details
            prepend-icon="mdi-view-column-outline"
            :disabled="isLanelessNote(appendNote)"
          >
            <v-radio v-for="n in 5" :key="n" :value="n"></v-radio>
          </v-radio-group>
          <v-spacer></v-spacer>
          <div>
            <v-btn
              class="ml-1"
              color="green"
              @click="placeNotes(appendNote)"
            >
              ノートを仮配置
              <v-icon right>mdi-keyboard-return</v-icon>
            </v-btn>
            <v-badge
              overlap
              color="orange darken-4"
              :model-value="preAppendNotes.length > 0"
              :content="preAppendNotes.length"
            >
              <v-btn
                class="ml-4"
                color="orange"
                theme="dark"
                append-icon="mdi-plus-circle-outline"
                @click="appendNotes(...preAppendNotes)"
              >
                挿入する
              </v-btn>
            </v-badge>
          </div>
        </v-row>

        <div class="my-4" v-show="appendNote.type === 2 || (appendNote.type == 90 && Number(appendNote.option[0]) === 2)">
          <v-row align="center" justify="space-between">
            <h4>ロングノーツ編集</h4>
            <v-btn
              color="green"
              prepend-icon="mdi-plus-circle-outline"
              @click="addEndToAppendNote"
            >
              終点を追加
            </v-btn>
          </v-row>

          <EndForm
            v-for="(end, i) in appendNote.end"
            :key="`append_end_${i}`"
            :end="end"
            :parent="appendNote"
            :index="i"
            :max-measure="maxMeasure"
            @delete-end="deleteEndOfAppendNote"
            @append-to-left="appendNoteToLeft"
            @append-to-right="appendNoteToRight"
            @append-to-up="appendNoteToUp"
            @append-to-down="appendNoteToDown"
            @place-notes="placeNotes(appendNote)"
          >
          </EndForm>

          <v-alert
            v-if="appendNote.end.length === 0"
            class="mt-2"
            density="compact"
            type="warning"
            rounded="lg"
          >
            終点が1つもありません
          </v-alert>
        </div>
      </v-card>

      <h3>プレビュー領域の設定</h3>

      <h5>現在のハイスピードの速度値:{{ (musicBpm * beatHeight) / 100 }}</h5>

      <v-slider
        v-model="beatHeight"
        :thumb-size="24"
        color="primary"
        thumb-label="always"
        min="20"
        max="300"
        append-icon="mdi-magnify-plus-outline"
        prepend-icon="mdi-magnify-minus-outline"
        @click:append="zoomIn"
        @click:prepend="zoomOut"
        step="10"
        hide-details
      ></v-slider>

      <v-row align="center">
        <v-col cols="12" sm="6">
          <v-file-input
            accept="audio/*"
            label="楽曲ファイル選択"
            variant="outlined"
            density="compact"
            prepend-icon="mdi-music"
            @update:model-value="readAudioFile"
            hide-details
          ></v-file-input>
        </v-col>
        <v-col cols="12" sm="6">
          <v-slider
            v-model="audioVolume"
            :thumb-size="24"
            color="primary"
            thumb-label="hover"
            min="0"
            max="100"
            prepend-icon="mdi-volume-high"
            step="5"
            hide-details
          ></v-slider>
        </v-col>
      </v-row>

      <v-row align="center" class="mb-4">
        <v-text-field
          v-model.number="scrollTo"
          suffix="小節へ"
          variant="outlined"
          density="compact"
          hide-details
        ></v-text-field>
        <v-btn prepend-icon="mdi-arrow-right" color="primary" @click="scrollToMeasure(scrollTo)">
          遷移
        </v-btn>
      </v-row>

      <h3>プレビュー表示モード</h3>

      <v-row class="my-0">
        <v-checkbox
          prepend-icon="mdi-format-align-justify"
          v-model="isShowDetail"
          label="ノーツ詳細を表示"
          hide-details
          density="compact"
        ></v-checkbox>
      </v-row>
      <v-row class="my-0">
        <v-checkbox
          prepend-icon="mdi-camera"
          :disabled="!isShowDetail"
          v-model="isCaptureMode"
          label="キャプチャ用モード"
          hide-details
          density="compact"
        ></v-checkbox>
      </v-row>
      <v-row class="my-0">
        <v-checkbox
          prepend-icon="mdi-play-circle-outline"
          :disabled="!isShowDetail || !isCaptureMode || isImageMode"
          v-model="isPreviewMode"
          label="譜面プレビュー用"
          hide-details
          density="compact"
        ></v-checkbox>
      </v-row>
      <v-row class="my-0">
        <v-checkbox
          prepend-icon="mdi-image"
          :disabled="!isShowDetail || !isCaptureMode || isPreviewMode"
          v-model="isImageMode"
          label="譜面画像生成用"
          hide-details
          density="compact"
        ></v-checkbox>
      </v-row>
      <v-row class="my-0">
        <v-checkbox
          prepend-icon="mdi-stop-circle"
          v-model="isSimulateStop"
          label="譜面停止をシミュレート"
          density="compact"
        ></v-checkbox>
      </v-row>

      <h3>選択ノーツ（選択中：{{ selectionNumber }}個）</h3>

      <v-row align="center" class="py-2">
        <v-btn color="primary" variant="outlined" prepend-icon="mdi-checkbox-marked-circle-outline" @click="dialog.batchcheck = true">
          ノーツの一括選択
        </v-btn>

        <v-btn color="warning" variant="outlined" prepend-icon="mdi-select-off" @click="selectionClear">
          すべて選択解除
        </v-btn>

        <v-dialog v-model="dialog.selectionDelete" width="500">
          <template v-slot:activator="{ props }">
            <v-btn
              color="error"
              variant="outlined"
              prepend-icon="mdi-delete-forever"
              @click="dialog.selectionDelete = true"
              v-bind="props"
            >
              選択ノーツを削除
            </v-btn>
          </template>
          <v-card>
            <v-card-title class="headline">確認</v-card-title>
            <v-card-text>
              本当に選択したノーツ{{ selectionNumber }}個をすべて削除しますか？
            </v-card-text>
            <v-divider></v-divider>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn
                color="primary"
                variant="outlined"
                @click="dialog.selectionDelete = false"
              >
                キャンセル
              </v-btn>
              <v-btn color="error" variant="outlined" @click="selectionDelete">
                削除する
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-btn color="primary" variant="outlined" prepend-icon="mdi-auto-fix" @click="dialog.checked = true">
          ノーツの一括操作
        </v-btn>
      </v-row>

      <h3>譜面情報</h3>

      <v-row align="center">
        <v-col>
          <v-text-field
            v-model.number="chartObject.info.offset"
            label="オフセット"
            required
            variant="outlined"
            density="compact"
            hide-details
          ></v-text-field>
        </v-col>
        <v-col>
          <v-text-field
            v-model.number="chartObject.info.bpm"
            label="BPM"
            required
            variant="outlined"
            density="compact"
            hide-details
          ></v-text-field>
        </v-col>
        <v-col>
          <v-text-field
            v-model.number="chartObject.info.beat"
            label="拍子"
            required
            variant="outlined"
            density="compact"
            hide-details
          ></v-text-field>
        </v-col>
        <v-col>
          <v-text-field
            v-model.number="chartObject.info.version"
            label="譜面ver"
            variant="outlined"
            density="compact"
            disabled
            hide-details
          ></v-text-field>
        </v-col>
      </v-row>

      <v-row>
        <v-btn color="primary" @click="dialog.help = true" variant="outlined" prepend-icon="mdi-help-circle">
          使い方
        </v-btn>
        <v-btn
          color="primary"
          @click="dialog.logs = !dialog.logs"
          variant="outlined"
          prepend-icon="mdi-message-outline"
        >
          メッセージログ
        </v-btn>
        <v-btn color="primary" @click="analyze" variant="outlined" prepend-icon="mdi-chart-timeline-variant">
          譜面分析
        </v-btn>
      </v-row>
      <v-row>
        <v-btn color="success" @click="saveFile" variant="outlined" prepend-icon="mdi-content-save">
          名前をつけて保存
        </v-btn>
        <v-btn color="success" @click="restoreBackup" variant="outlined" prepend-icon="mdi-file-restore">
          復元
        </v-btn>
      </v-row>

      <v-card
        v-if="dialog.logs"
        class="mx-auto message-log"
        elevation="2"
        rounded="lg"
        title="メッセージログ"
      >
        <template #prepend>
          <v-btn icon="mdi-close" variant="text" @click="dialog.logs = false" />
        </template>

        <v-list subheader>
          <v-list-item v-for="item in logs.slice().reverse()" :key="item.date.getTime()">
              <p class="mb-2 d-flex">
                <v-chip class="flex-shrink-0 mr-2" label>
                  {{ item.type }}
                </v-chip>
                {{ item.message }}
              </p>
              <v-list-item-subtitle>
                {{ item.date.toLocaleString("ja-JP") }}
              </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card>
    </v-container>

    <v-dialog v-model="dialog.help" width="800" scrollable>
      <v-card rounded="xl" title="エディタの使い方" prepend-icon="mdi-help-circle">
        <template #append>
          <v-btn icon="mdi-close" variant="text" @click="dialog.help = false" />
        </template>
        <v-divider></v-divider>
        <v-card-text style="max-height: 70vh; overflow-y: auto;">
          <div v-html="renderedUsage" class="usage-content"></div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="dialog.analyzer" width="800">
      <v-card rounded="xl" prepend-icon="mdi-chart-timeline-variant" :title="`譜面分析 (${currentDifficulty})`">
        <v-divider></v-divider>
        <v-card-text>
          ノーツ数：{{ analysisData.notesCount }}
          <br />
          オブジェクト数：{{ currentChart.length }}
          <br />
          平均密度：{{
            (analysisData.notesCount / (measureData.at(-1)?.measureReachTime ?? 1)) *
              1000
          }}Notes / 秒
        </v-card-text>
        <v-divider></v-divider>
        <v-sparkline
          v-if="dialog.analyzer"
          :labels="analysisData.trendLabels"
          :model-value="analysisData.trendValues"
          :gradient="['#f72047', '#ffd200', '#1feaea']"
          color="black"
          line-width="2"
          padding="10"
          :smooth="3"
          type="trend"
          show-labels
          style="width: 100%; display: block;"
        ></v-sparkline>
        <v-sparkline
          v-if="dialog.analyzer"
          :model-value="analysisData.otofudaNotes"
          color="orange"
          line-width="2"
          height="10"
          padding="0"
          :smooth="0"
          fill
          type="trend"
          style="width: 100%; display: block;"
        ></v-sparkline>
        <v-card-text class="mt-4">
          ▲音札ノーツの位置
        </v-card-text>
        <v-table>
          <thead>
            <tr>
              <th class="text-left">
                種類別ノーツ数
              </th>
              <th class="text-left">
                数
              </th>
              <th class="text-left">
                割合
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="type in noteTypes" :key="`note_count_${type.value}`">
              <td>{{ type.title }}</td>
              <td>{{ analysisData.typeCount[type.value] }}</td>
              <td>
                {{
                  [1, 2, 3, 4, 5, 6, 7].includes(type.value)
                    ? `${Math.floor(
                        (analysisData.typeCount[type.value] /
                          analysisData.notesCount) *
                          10000
                      ) / 100}％`
                    : "－"
                }}
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </v-dialog>

    <v-dialog v-model="dialog.checked" width="800">
      <v-card rounded="xl" prepend-icon="mdi-auto-fix" title="選択ノーツへの一括操作">
        <template #append>
          <v-btn
            icon="mdi-close"
            variant="text"
            @click="dialog.checked = false"
          />
        </template>
        <v-divider></v-divider>
        <v-card-text>
          <strong>
            種別の変更
          </strong>
          <p>
            選択したノーツ(ロングノーツと音札ノーツを除く)を特定の種別に一括で変更します。
          </p>
          <v-row align="center" class="mx-1">
            <v-text-field
              type="number"
              v-model.number="selectionTypeTo"
              min="1"
              max="99"
              prefix="Type："
              variant="outlined"
              density="compact"
              hide-details
            ></v-text-field>
            <v-btn
              prepend-icon="mdi-auto-fix"
              color="primary"
              @click="selectionChangeType(selectionTypeTo)"
            >
              選択ノーツを全て種別変更
            </v-btn>
          </v-row>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-text>
          <strong>
            レーンの変更
          </strong>
          <p>
            選択したノーツ(ロングノーツと音札ノーツを除く)を特定のレーンに一括で移動します。(選択範囲、または対象レーンに対して)同時押しを含む範囲に対して実行すると重複が発生します。
          </p>
          <v-row align="center" class="mx-1">
            <v-text-field
              type="number"
              v-model.number="selectionLaneTo"
              min="1"
              max="5"
              prefix="Lane："
              variant="outlined"
              density="compact"
              hide-details
            ></v-text-field>
            <v-btn
              prepend-icon="mdi-auto-fix"
              color="primary"
              @click="selectionChangeLane(selectionLaneTo)"
            >
              選択ノーツを全てレーン移動
            </v-btn>
          </v-row>
        </v-card-text>
        <v-card-text>
          <strong>
            レーンの加算／減算
          </strong>
          <p>
            選択したノーツ(ロングノーツと音札ノーツを除く)のそれぞれのレーンを1～5の範囲内で加算または減算します。入力は「－4」～「＋4」の範囲。
          </p>
          <v-row align="center" class="mx-1">
            <v-text-field
              type="number"
              v-model.number="selectionLaneAddition"
              min="-4"
              max="4"
              prefix="値："
              variant="outlined"
              density="compact"
              hide-details
            ></v-text-field>
            <v-btn
              prepend-icon="mdi-auto-fix"
              color="primary"
              @click="selectionAddLane(selectionLaneAddition)"
            >
              各選択ノーツのレーンを加算／減算
            </v-btn>
          </v-row>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-text>
          <strong>
            小節の移動
          </strong>
          <p>
            選択したノーツの配置小節位置を加算または減算します。入力は正または負の整数。
          </p>
          <v-row align="center" class="mx-1">
            <v-text-field
              type="number"
              v-model.number="selectionMeasureAddition"
              min="-4"
              max="4"
              prefix="値："
              variant="outlined"
              density="compact"
              hide-details
            ></v-text-field>
            <v-btn
              prepend-icon="mdi-auto-fix"
              color="primary"
              @click="selectionAddMeasure(selectionMeasureAddition)"
            >
              選択ノーツの小節を加算／減算
            </v-btn>
          </v-row>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="dialog.batchcheck" width="800">
      <v-card rounded="xl" prepend-icon="mdi-checkbox-marked-circle-outline" title="ノーツの一括選択">
        <template #append>
          <v-btn
            icon="mdi-close"
            @click="dialog.batchcheck = false"
            variant="text"
          >
          </v-btn>
        </template>
        <v-divider></v-divider>
        <v-card-text>
          <strong>
            対象Type
          </strong>
          <p>
            対象Typeに合致するノーツを選択対象に加えます。
            <v-btn
              color="primary"
              variant="text"
              @click="batchSelectTypes = noteTypes.map(t => t.value)"
            >
              すべて選択
            </v-btn>
            <v-btn
              color="primary"
              variant="text"
              @click="batchSelectTypes = []"
            >
              すべて解除
            </v-btn>
          </p>
          <v-checkbox
            class="d-inline-block mr-4"
            v-for="(type) in noteTypes"
            :key="`batch-select-type_${type.value}`"
            v-model="batchSelectTypes"
            :label="type.title"
            :value="type.value"
            hide-details
            density="compact"
          ></v-checkbox>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-text>
          <strong>
            対象小節
          </strong>
          <p>
            対象小節の範囲内のノーツを選択対象に加えます。終了小節を0にすると譜面の最後までを対象とします。
          </p>
          <v-row align="center">
            <v-text-field
              v-model.number="batchSelectStart"
              type="number"
              min="0"
              prefix="開始："
              suffix="小節"
              variant="outlined"
              density="compact"
              hide-details
            ></v-text-field>
            <v-text-field
              v-model.number="batchSelectEnd"
              type="number"
              min="0"
              prefix="終了："
              suffix="小節"
              variant="outlined"
              density="compact"
              hide-details
            ></v-text-field>
          </v-row>
          <p>予測される選択個数：{{ batchSelectTarget.length }}</p>
        </v-card-text>
        <template #actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="outlined" prepend-icon="mdi-checkbox-marked-circle-outline" @click="batchSelect">
            すべて選択する
          </v-btn>
        </template>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" rounded="lg" vertical>
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn color="error" variant="text" @click="snackbar = false">
          閉じる
        </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, provide, onMounted } from 'vue'
import { useGoTo } from 'vuetify'

import { type DifficultyString, type ExtendedNoteData } from './types'
import { type NoteData, type LaneType } from 'chart-types'

import Preview from './components/Preview.vue'
import EndForm from './components/EndForm.vue'

import usageContent from '../Usage.md?raw'

import { useChartData } from './composables/useChartData'
import { useNoteEditor } from './composables/useNoteEditor'
import { useSelection } from './composables/useSelection'
import { useFileIO } from './composables/useFileIO'
import { useTextureDB } from './composables/useTextureDB'
import { useBackup } from './composables/useBackup'
import { noteTypes, noteOptions } from './composables/useNoteTypes'
import { isLanelessNote } from './composables/useNoteCheck'
import {
  showSnackbarKey,
  deleteNotesKey,
  cancelNoteKey,
  appendNotesKey,
  getMovedNoteKey,
  copyNotesToDifficultyKey,
  setAppendNoteInfoKey,
} from './composables/injectionKeys'

// --- composable の初期化 ---
const chartData = useChartData()
const { chartObject, currentChart, currentDifficulty, measureData, beatHeight, maxMeasure, isSimulateStop, musicBpm, difficulties } = chartData

const backup = useBackup(chartData)
const { snackbar, snackbarText, logs, analysisData, showSnackbar, saveBackup, restoreBackup, analyze: runAnalyze } = backup

// scrollToMeasure 関数 (goTo は Vuetify 4 composable)
const goTo = useGoTo()
function scrollToMeasure(measureNumber: number): void {
  const m = measureData.value[measureNumber]
  const last = measureData.value.at(-1)
  if (!m || !last) { showSnackbar(`${measureNumber}小節はありません`); return }
  goTo(last.measurePositionBottom - m.measurePositionBottom)
}

const noteEditor = useNoteEditor(chartData, showSnackbar, scrollToMeasure)
const {
  appendNote, preAppendNotes, isAppendMode, isAutoFollow,
  appendNoteColorOption, appendNotes, placeNotes, appendSimultaneously,
  addEndToAppendNote, deleteEndOfAppendNote, changeAppendNoteType,
  appendNoteToLeft, appendNoteToRight, appendNoteToUp, appendNoteToDown,
  setAppendNoteInfo, cancelNote, copyNotesToDifficulty, getMovedNote,
} = noteEditor

const selection = useSelection(chartData, showSnackbar)
const {
  batchSelectTypes, batchSelectStart, batchSelectEnd, batchSelectTarget,
  selectionNumber, selectionLaneTo, selectionLaneAddition, selectionTypeTo,
  selectionMeasureAddition, selectionClear, selectionDelete: doSelectionDelete,
  selectionChangeType, selectionChangeLane, selectionAddLane, selectionAddMeasure, batchSelect,
} = selection

const fileIO = useFileIO(chartData, showSnackbar)
const { fileName, isLoaded, previewAudio, audioVolume, readFile, newFile, saveFile, readAudioFile } = fileIO

const textureDB = useTextureDB(appendNote, showSnackbar)
const { texturePayload, textureTabs, textureCurrentTab, setTexture } = textureDB

// --- ローカル UI 状態 ---
const dialog = ref({
  selectionDelete: false,
  analyzer: false,
  help: false,
  logs: false,
  checked: false,
  batchcheck: false,
  texture: false,
})

const scrollTo = ref(0)
const isShowDetail = ref(false)
const isCaptureMode = ref(false)
const isPreviewMode = ref(false)
const isImageMode = ref(false)

const colorSwatches = [
  ['#ff5151', '#000000'],
  ['#44a5ff', '#202020'],
  ['#ff0000', '#505050'],
  ['#00ff00', '#a0a0a0'],
  ['#0000ff', '#ffffff'],
]

// getAppendNote
const getAppendNote = computed(() => isAppendMode.value ? appendNote.value : null)

// noteOptionsForAppendNote
const noteOptionsForAppendNote = computed(() => noteOptions(appendNote.value))

// infoObject (version を必須に正規化)
const chartInfo = computed(() => ({
  ...chartObject.value.info,
  version: chartObject.value.info.version ?? 2,
}))

// selectionDelete (ダイアログを閉じるコールバック付き)
function selectionDelete() {
  doSelectionDelete(() => { dialog.value.selectionDelete = false })
}

// analyze (ダイアログ開く)
function analyze() {
  runAnalyze()
  dialog.value.analyzer = true
}

// Usage.md をシンプルなHTMLに変換（行ごとの状態管理パーサー）
const renderedUsage = computed((): string => {
  const inline = (s: string) => s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

  const out: string[] = []
  let inTable = false
  let tableInBody = false

  for (const line of usageContent.split('\n')) {
    const t = line.trim()
    const isRow = t.startsWith('|') && t.endsWith('|') && t.length > 1
    // セパレータ行: | --- | または |:---|---:| など
    const isSep = isRow && /^\|[- |:=]+\|$/.test(t)

    if (isSep) {
      // ヘッダー → ボディへ切り替え
      out.push('</thead><tbody>')
      tableInBody = true
      continue
    }

    if (isRow) {
      if (!inTable) {
        out.push('<table style="border-collapse:collapse;width:100%;margin:8px 0"><thead>')
        inTable = true
        tableInBody = false
      }
      const cells = t.slice(1, -1).split('|').map(c => inline(c.trim()))
      const tag = tableInBody ? 'td' : 'th'
      const style = tableInBody
        ? 'padding:4px 8px;border:1px solid #ddd'
        : 'padding:4px 8px;border:1px solid #ddd;background:#f5f5f5;text-align:left'
      out.push(`<tr>${cells.map(c => `<${tag} style="${style}">${c}</${tag}>`).join('')}</tr>`)
      continue
    }

    // テーブル外の行: テーブルを閉じる
    if (inTable) {
      out.push('</tbody></table>')
      inTable = false
      tableInBody = false
    }

    if (/^### /.test(line))       out.push(inline(line).replace(/^### (.+)$/, '<h4 class="text-subtitle-1 font-weight-bold mt-3 mb-1">$1</h4>'))
    else if (/^## /.test(line))   out.push(inline(line).replace(/^## (.+)$/, '<h3 class="text-h6 mt-4 mb-1">$1</h3>'))
    else if (/^# /.test(line))    out.push(inline(line).replace(/^# (.+)$/, '<h2 class="text-h5 mt-4 mb-2">$1</h2>'))
    else if (/^\- /.test(line))   out.push(inline(line).replace(/^\- (.+)$/, '<li style="margin-left:20px">$1</li>'))
    else if (t === '---')         out.push('<hr style="margin:16px 0">')
    else if (/^> /.test(line))    out.push(inline(line).replace(/^> (.+)$/, '<blockquote style="border-left:4px solid #ccc;padding-left:12px;color:#666;margin:8px 0">$1</blockquote>'))
    else if (t === '')            out.push('<br>')
    else                          out.push(inline(line))
  }

  if (inTable) out.push('</tbody></table>')

  return out.join('\n')
})

// zoom
function zoomIn() { beatHeight.value = (beatHeight.value + 10) || 100 }
function zoomOut() { beatHeight.value = Math.max((beatHeight.value - 10) || 0, 0) }

// --- Provide (typed) ---
provide(showSnackbarKey, showSnackbar)
provide(deleteNotesKey, chartData.deleteNotes)
provide(cancelNoteKey, cancelNote)
provide(appendNotesKey, appendNotes)
provide(getMovedNoteKey, getMovedNote)
provide(copyNotesToDifficultyKey, copyNotesToDifficulty)
provide(setAppendNoteInfoKey, setAppendNoteInfo)

// --- Lifecycle ---
onMounted(() => {
  textureDB.fetchTextures()
  window.addEventListener('beforeunload', (e) => {
    e.preventDefault()
    e.returnValue = '移動してもよろしいですか？'
  })
})

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault()
    saveBackup()
  }
})


</script>

<style lang="scss">
#app {
  font-family: "Open Sans", "Noto Sans JP", Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #333333;
  background: #202020;
  .panel {
    position: fixed;
    background: #f0f0f0;
    top: 0;
    left: 0;
    width: calc(100% - 420px);
    height: 100vh;
    overflow-y: auto;
    padding: 12px 32px;
    .logo {
      margin-left: -12px;
      max-height: 96px;
      max-width: calc(100vw - 720px);
    }
    h3,
    h5 {
      margin: 8px -12px;
    }
  }
  .difficulty-select {
    margin-top: 8px;
    .v-btn {
      width: 90px;
      border-radius: 0;
      &:first-child {
        border-radius: 8px 0 0 8px;
      }
      &:last-child {
        border-radius: 0 8px 8px 0;
      }
    }
  }
  .v-menu__content {
    z-index: 111 !important;
  }
  .row {
    margin-top: 0;
    margin-bottom: 10px;
  }
}
.note {
  position: absolute;
  z-index: 100;
  color: #606060;
  background: linear-gradient(
    to left,
    transparent 3.99%,
    #ffffff 4%,
    #ffffff 96%,
    transparent 96.01%
  );
  height: 4px;
  overflow: visible;
  color: transparent;
  text-align: right;
  transition: 0.1s all ease;
  strong {
    color: #a0a0a0;
    &.speed { color: #f08080; }
    &.orbit { color: #87cefa; }
  }
  input[type="checkbox"] {
    position: absolute;
    right: 0;
    top: -20px;
    display: none;
  }
  > img {
    width: 100%;
  }
  &.menu {
    box-shadow: 0 0 4px 4px rgba(125, 255, 125, 0.5);
  }
  &:hover {
    color: #909090;
  }
  &.type2 {
    background: linear-gradient(
      to left,
      transparent 3.99%,
      #e9b75c 4%,
      #e9b75c 96%,
      transparent 96.01%
    );
    width: 60px;
  }
  &.type3 {
    z-index: 99;
    height: 6px;
    background: #87cefa;
    &::before {
      content: "";
      display: inline-block;
      position: absolute;
      left: -10px;
      top: -7.5px;
      height: 0;
      width: 0;
      border-top: 10px solid transparent;
      border-right: 20px solid #87cefa;
      border-bottom: 10px solid transparent;
    }
  }
  &.type4 {
    z-index: 99;
    height: 6px;
    background: #f08080;
    &::after {
      content: "";
      display: inline-block;
      position: absolute;
      right: -10px;
      top: -7.5px;
      height: 0;
      width: 0;
      border-top: 10px solid transparent;
      border-left: 20px solid #f08080;
      border-bottom: 10px solid transparent;
    }
  }
  &.type5 {
    height: 8px;
    background: linear-gradient(to right, gold, #fde08d, gold);
  }
  &.type6 {
    z-index: 99;
    height: 6px;
    background: #87f080;
    &::after {
      content: "";
      display: inline-block;
      position: absolute;
      left: calc(50% - 20px);
      top: -16px;
      height: 0;
      width: 0;
      border-left: 20px solid transparent;
      border-right: 20px solid transparent;
      border-bottom: 20px solid #87f080;
    }
  }
  &.type7 {
    z-index: 99;
    height: 6px;
    background: #ec80f0;
    &::after {
      content: "";
      display: inline-block;
      position: absolute;
      left: calc(50% - 20px);
      top: 2px;
      height: 0;
      width: 0;
      border-left: 20px solid transparent;
      border-right: 20px solid transparent;
      border-top: 20px solid #ec80f0;
    }
  }
  &.type89 {
    height: 0;
    background: transparent;

    & + .note-hold {
      border-radius: 5px 5px 0 0;
    }
  }
  &.type94 {
    z-index: 1;
    height: auto;
    background: transparent;
    line-height: 0;
    > i {
      position: absolute;
    }
    &:hover {
      background: rgba(255, 255, 255, 0.25);
    }
  }
  &.type91 {
    z-index: 98;
    height: 3px;
    height: 0;
    text-align: right;
    border-top: 5px dotted #50dcff;
  }
  &.type95 {
    z-index: 98;
    height: 1px;
    background: #a0a0a0;
    &.hidden {
      background: transparent;
    }
  }
  &.type96 {
    z-index: 98;
    height: 40px;
    background: gray;
    border: 3px solid rgba(255, 255, 255, 0.5);
    border-radius: 6px;
  }
  &.type92 {
    z-index: 98;
    height: 3px;
    height: 0;
    text-align: center;
    border-top: 4px dotted #d950ff;
  }
  &.type93 {
    z-index: 98;
    height: 3px;
    height: 0;
    text-align: center;
    border-top: 4px dotted #70ff50;
  }
  &.type97 {
    z-index: 98;
    height: 1px;
    background: greenyellow;
    text-align: left;
  }
  &.type98 {
    z-index: 98;
    height: 1px;
    background: yellow;
  }
  &.type99 {
    z-index: 98;
    height: 0;
    border-top: 2px dashed #ff5050;
  }
  &.type100 {
    background: transparent;
    height: 20px;
    > .v-input {
      display: none;
      position: absolute;
      bottom: 20px;
      right: 0;
      min-width: 180px;
    }
    &:hover > .v-input {
      display: block;
    }
  }
}
.preview.detail .note {
  color: #f0f0f0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
.preview.checkbox .note input[type="checkbox"] {
  display: block;
}

// キャプチャ用モード
.preview.detail.capture_mode {
  .note,
  .note-invisible-badge,
  .note-midpoint {
    color: #a0a0a0;
    > .v-icon {
      display: none;
    }
    .speed,
    .orbit {
      visibility: hidden;
    }
  }
  .note.type94,
  .note.type95 {
    color: transparent;
    text-shadow: none;
  }
  .note.type96,
  .note.type100 {
    visibility: hidden;
  }
  // 譜面プレビュー用モード
  &.preview_mode {
    .measure > .v-btn {
      opacity: 0;
    }
    .measure__number {
      visibility: hidden;
    }
    .note,
    .note-invisible-badge,
    .note-midpoint {
      color: transparent;
      text-shadow: none;

      .speed,
      .orbit {
        visibility: hidden;
      }
    }
    .note.type5 {
      box-shadow: 0 0 16px 0 gold;
    }
    .note.type91,
    .note.type92,
    .note.type93,
    .note.type97,
    .note.type98,
    .note.type99 {
      visibility: hidden;
    }
  }
  // 譜面画像生成用モード
  &.image_mode {
    margin-bottom: 0 !important;

    .measure > .v-btn {
      opacity: 0;
    }
    .note,
    .note-invisible-badge,
    .note-midpoint {
      color: transparent;
      text-shadow: none;
      &.shadow,
      &.type91,
      &.type97,
      &.type98,
      &.type99 {
        visibility: hidden;
      }
      &.type96 {
        visibility: visible;
        height: 20px;
        border-width: 2px;
        border-radius: 4px;
        width: 20px !important;
        left: -40px !important;
      }
      .speed,
      .orbit {
        visibility: hidden;
      }
    }
  }
}

.flick-effect {
  position: absolute;
  bottom: 0px;
  width: 120px;
  height: 100px;
  left: 0px;
  transform-origin: bottom center;
  filter: blur(16px);
  animation-iteration-count: 1;
  &.-left {
    background: radial-gradient(
      at 50% 100%,
      #87cefaf0 0%,
      #87cefaa0 5%,
      #87cefa00 60%
    );
    animation: 250ms flickLeft ease;
  }
  &.-right {
    background: radial-gradient(
      at 50% 100%,
      #f08080f0 0%,
      #f08080a0 5%,
      #f0808000 60%
    );
    animation: 250ms flickRight ease;
  }
  &.-up {
    background: radial-gradient(
      at 50% 100%,
      #87f080f0 0%,
      #87f080a0 5%,
      #87f08000 60%
    );
    animation: 250ms flickUp ease;
  }
  &.-down {
    background: radial-gradient(
      at 50% 100%,
      #ec80f0f0 0%,
      #ec80f0a0 5%,
      #ec80f000 60%
    );
    animation: 250ms flickDown ease;
  }
}

@keyframes flickLeft {
  from {
    transform: scaleX(2) scaleY(1);
  }
  to {
    transform: scaleX(0.5) scaleY(0) translateX(-100%);
  }
}
@keyframes flickRight {
  from {
    transform: scaleX(2) scaleY(1);
  }
  to {
    transform: scaleX(0.5) scaleY(0) translateX(100%);
  }
}
@keyframes flickUp {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(2);
    opacity: 0;
  }
}
@keyframes flickDown {
  from {
    transform: scaleY(1);
  }
  to {
    transform: scaleY(0);
    opacity: 0;
  }
}

// テクスチャセレクター
.texture-card {
  width: 180px;
  &__name {
    display: inline-block;
    font-size: 12px;
    padding: 4px;
    margin-left: 6px;
    margin-top: 4px;
    border-radius: 4px;
    color: #ffffff;
    background: rgba(0, 0, 0, 0.5);
  }
}

.note-hold {
  position: absolute;
  z-index: 98;
  background: #ffffec;
  opacity: 0.9;
  width: 38px;
  margin: 0 11px;
  border-left: 4px solid #6ecc6e;
  border-right: 4px solid #6ecc6e;
  transition: 0.1s all ease;
}

// ロングノーツの帯（SVG）
.long-note-svg {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 420px;
  z-index: 98;
  pointer-events: none;
  overflow: visible;

  .hold-fill {
    fill: #ffffec;
    fill-opacity: 0.9;
    transition: 0.1s all ease;
  }
  .hold-border {
    fill: none;
    stroke: #6ecc6e;
    stroke-width: 4;
    stroke-linecap: round;
  }

  // 他難易度シャドー表示時
  &.shadow {
    opacity: 0.6;
  }

  // ノート仮配置時
  &.preappend {
    opacity: 0.85;
  }
}

// ロングノーツのコンボ加算中点（type: 1 の中間中継点）
.note-midpoint {
  position: absolute;
  z-index: 101;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #6ecc6e;
  box-sizing: border-box;
  transition: 0.1s all ease;
  pointer-events: auto;

  .midpoint-badges {
    position: absolute;
    left: 13px;
    top: -5px;
    white-space: nowrap;
    line-height: 1;
    pointer-events: none;

    strong {
      color: #a0a0a0;
      &.speed { color: #f08080; }
      &.orbit { color: #87cefa; margin-left: 2px; }
    }
  }

  // 他難易度シャドー表示時
  &.shadow {
    opacity: 0.6;
  }

  // ノート仮配置時
  &.preappend {
    opacity: 0.85;
  }
}

// 不可視ノード（type: 89）の speed / orbit バッジ表示用アンカー
.note-invisible-badge {
  position: absolute;
  z-index: 100;
  height: 4px;
  overflow: visible;
  text-align: right;
  pointer-events: auto;

  strong {
    color: #a0a0a0;
    &.speed { color: #f08080; }
    &.orbit { color: #87cefa; margin-left: 2px; }
  }

  // 他難易度シャドー表示時
  &.shadow {
    opacity: 0.6;
  }

  // ノート仮配置時
  &.preappend {
    opacity: 0.85;
  }
}

.message-log {
  position: fixed;
  top: 20px;
  left: 20px;
  width: 400px;

  > .v-list {
    height: 300px;
    overflow-y: scroll;
  }
}
</style>
