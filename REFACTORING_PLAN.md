# Chart Editor V2 リファクタリング計画

## 概要

| 項目 | 移行前 | 移行後 |
|------|--------|--------|
| フレームワーク | Vue 2.7 | Vue 3 |
| ビルドツール | RSBuild | Vite 8 |
| UI コンポーネント | Vuetify 2 | Vuetify 4 |
| スクリプトスタイル | Options API (Vue.extend) | `<script setup>` + Composition API |
| ロジック配置 | App.vue 2256行に集中 | 機能別 Composable (8個) |
| ビジネスロジックテスト | なし | Vitest (日本語テストケース) |
| buryjs | 使用 | 削除 (標準 ECMAScript に置換) |
| html2canvas | 使用 | 削除 |
| Provide/Inject | 文字列キー | typed `InjectionKey<T>` |

## 移行アプローチ

**ビッグバン（1ブランチで全フェーズを一気に実施）**

---

## Phase 1: ビルドシステム移行

### 削除ファイル
- `rsbuild.config.ts`
- `babel.config.js`
- `vue.config.js`

### 新規ファイル
- `vite.config.ts` — Vite 8 設定 (base: '/chart-editor/')
- `vitest.config.ts` — テスト環境設定 (environment: jsdom)
- `index.html` (プロジェクトルート) — Vite エントリ用

### 更新ファイル
- `package.json` — 依存関係の全面入れ替え
- `tsconfig.json` — `moduleResolution: "bundler"` に変更
- `src/env.d.ts` — `/// <reference types="vite/client" />`
- `src/shims-vuetify.d.ts` — 削除 (Vuetify 4 は型を内包)
- `public/index.html` — RSBuild テンプレート変数の除去
- `src/main.ts` — `createApp(App).use(vuetify).mount('#app')`
- `src/plugins/vuetify.ts` — `createVuetify({...})`

### 依存関係の変更

**削除:**
```
@rsbuild/core, @rsbuild/plugin-vue2, vue-template-compiler
buryjs, html2canvas
vuetify@^2.x, vuetify-loader@^1.x
eslint-plugin-vue (optional)
```

**追加 (dependencies):**
```
vue@^3.5, vuetify@^4.0
```

**追加 (devDependencies):**
```
vite@^8.0, @vitejs/plugin-vue@^5.0, vite-plugin-vuetify@^2.0
vitest@^3.0, @vue/test-utils@^2.4, jsdom@^26.0
```

---

## Phase 2: 型定義・Composable 基盤

### 新規: `src/composables/injectionKeys.ts`
Provide/Inject を typed `InjectionKey<T>` で管理。文字列キー方式を廃止。

```ts
export const deleteNotesKey: InjectionKey<(...index: number[]) => void>
export const appendNotesKey: InjectionKey<(...notes: NoteData[]) => void>
export const showSnackbarKey: InjectionKey<(message: string) => void>
export const getMovedNoteKey: InjectionKey<(note: NoteData, measure: number) => NoteData>
export const copyNotesToDifficultyKey: InjectionKey<(difficulty: DifficultyString | null, ...notes: NoteData[]) => void>
export const setAppendNoteInfoKey: InjectionKey<(note: NoteData) => void>
export const cancelNoteKey: InjectionKey<(index: number) => void>
```

---

## Phase 3: Composable への切り出し

### 分割方針: 機能別細粒 (8個)

| Composable | 責務 | 依存 |
|---|---|---|
| `useNoteTypes` | ノートタイプ定数・オプション生成 | なし |
| `useNoteCheck` | 重複チェック・バリデーション純粋関数 | なし |
| `useChartData` | 譜面データ・measureData・beatHeight | - |
| `useNoteEditor` | ノート仮配置・挿入・移動・コピー | chartData, noteCheck, snackbar |
| `useSelection` | ノート一括選択・変更 | chartData, snackbar |
| `useFileIO` | JSON読込/保存・音声ファイル | chartData, snackbar |
| `useTextureDB` | テクスチャDB取得・適用 | appendNote, snackbar |
| `useBackup` | バックアップ保存/復元・アナライズ | chartData, snackbar |

### buryjs 置換マッピング

| buryjs | 標準 ECMAScript |
|---|---|
| `.each(fn)` | `.forEach(fn)` |
| `.append(...x)` | `.push(...x)` |
| `.uniq` | `[...new Set(arr)]` |
| `.first` | `arr.at(0)` |
| `.last` | `arr.at(-1)` |
| `.size` | `.length` |
| `.max_by(fn)` | `.reduce((a,b) => fn(a)>=fn(b)?a:b)` |
| `.delete_if(fn)` | `arr = arr.filter(x => !fn(x))` |
| `.delete_at(i)` | `arr.splice(i, 1)` |
| `n.times(fn)` | `Array.from({length:n}).forEach((_,i)=>fn(i))` |
| `new Bury()` | 削除 |

### 削除:
- `src/mixins/noteTypes.ts` → `src/composables/useNoteTypes.ts` に移植
- `src/mixins/noteCheck.ts` → `src/composables/useNoteCheck.ts` に移植 (pure functions 化)

---

## Phase 4: コンポーネント移行

### App.vue
- `Vue.extend({...})` → `<script setup lang="ts">`
- 全 mixin 削除、composable から import
- `this.$vuetify.goTo()` → `useGoTo()` composable (Vuetify 4)
- `this.$set(obj, key, val)` → `obj[key] = val` (Vue 3 不要)
- `provide()` → typed `provide(key, value)` に変更
- `beforeDestroy` → `onBeforeUnmount`

### Vuetify 2 → 4 テンプレート変更

| 変更前 | 変更後 |
|---|---|
| `v-slot:activator="{ on, attrs }"` + `v-bind="attrs" v-on="on"` | `v-slot:activator="{ props }"` + `v-bind="props"` |
| `v-tabs-items` / `v-tab-item` | `v-window` / `v-window-item` |
| `v-simple-table` | `v-table` |
| `v-list-item-content` | 削除 (子要素を v-list-item 直下に) |
| `v-snackbar v-slot:action="{ attrs }"` | `v-slot:actions` |
| `v-expansion-panel-header` | `v-expansion-panel-title` |
| `v-expansion-panel-content` | `v-expansion-panel-text` |
| `background-color=` (v-text-field) | `bg-color=` |
| `v-badge :value` | `:model-value` |
| `v-btn dark` | 削除 |

### Preview.vue
- `html2canvas` import + `screenshot()` メソッドを完全削除
- `this.$refs.preview` → `const preview = ref<HTMLElement>()`
- buryjs 除去 (`.each`, `.append` etc.)

### その他コンポーネント (Note.vue, Measure.vue, LongNote.vue, NoteShadow.vue, EndForm.vue, ObjectBasedMeasure.vue)
- `inject: ["key"]` → typed `inject(typedKey)!`
- mixin usage → composable import
- `beforeDestroy` → `onBeforeUnmount`
- buryjs 除去

---

## Phase 5: テスト追加

**`src/composables/__tests__/` 以下に Vitest テストを追加**

テストスコープ: composable + 純粋関数のみ

| テストファイル | テスト内容例 |
|---|---|
| `useNoteCheck.test.ts` | 「重複するノートを検出できる」「hasError が異常なノートを検出する」 |
| `useNoteTypes.test.ts` | 「ノートタイプ一覧が正しく定義されている」「noteOptions がノート種別に応じた設定を返す」 |
| `useChartData.test.ts` | 「currentChart が currentDifficulty に応じて切り替わる」「measureData が BPM 変化ノートを考慮する」 |
| `useNoteEditor.test.ts` | 「ノートを仮配置できる」「重複ノートは仮配置を拒否される」 |
| `useFileIO.test.ts` | 「JSON ファイルを読み込むと chartObject が更新される」 |
| `useSelection.test.ts` | 「全選択解除で全ノートの isSelected が false になる」 |

**テストケース命名規則**: 日本語で記述する

---

## Phase 6: 削除・クリーンアップ

```
rsbuild.config.ts
babel.config.js
vue.config.js
src/mixins/noteTypes.ts
src/mixins/noteCheck.ts
src/shims-vuetify.d.ts
public/index.html (→ プロジェクトルートに移動)
```

---

## 実装進捗

- [x] 計画書作成 (このファイル)
- [x] Phase 1: ビルドシステム (Vite 8, @vitejs/plugin-vue 6, vitest 最新版)
- [x] Phase 2: 型定義・Composable 基盤 (injectionKeys.ts, types.d.ts ColorObject 修正)
- [x] Phase 3: Composable 切り出し (useNoteTypes, useNoteCheck, useChartData, useNoteEditor, useSelection, useFileIO, useTextureDB, useBackup)
- [x] Phase 4: コンポーネント移行 (App.vue, Preview.vue, Note.vue, Measure.vue, LongNote.vue, NoteShadow.vue, EndForm.vue, ObjectBasedMeasure.vue)
- [x] Phase 5: テスト追加 (38テスト全パス)
- [x] Phase 6: クリーンアップ (mixins削除, buryjs削除, html2canvas削除)

## IDE エラー修正 (完了)

- [x] Vite 8 アップグレード + @vitejs/plugin-vue 6 + vitest 最新
- [x] ESM 互換設定 (vite.config.ts, vitest.config.ts: `fileURLToPath(new URL(...))`)
- [x] tsconfig.json: `ignoreDeprecations` 廃止対応 (TS 5.9 で不要のため削除)
- [x] env.d.ts: `*.vue` モジュール宣言追加
- [x] types.d.ts: `ColorObject` に `[key: string]: unknown` 追加
- [x] useFileIO.ts: readFile/readAudioFile を `File | File[] | null | undefined` 型に対応
- [x] App.vue: `@change` → `@update:model-value` (v-file-input), menu-props rounded 削除, 型エラー修正
- [x] LongNote.vue/Note.vue: `:id="note.index"` → `String(note.index)`, activator slot 修正
- [x] Measure.vue: `notes.size` → `notes.length`, rounded 削除, hide-details 修正
- [x] NoteShadow.vue: `measureData.last` → `measureData.at(-1)?`
- [x] Preview.vue: `next` の型を `Measure | undefined` に修正, optional chaining 追加
- [x] EndForm.vue: maxMeasure を required→optional(default:999), 再帰呼び出しに prop 渡し追加
- [x] useNoteEditor.test.ts: `LaneType` 型インポートと as キャスト追加
