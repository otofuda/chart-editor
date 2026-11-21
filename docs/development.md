# 開発ガイド

セットアップ、作業対象、確認方法を調べるための案内です。共通の開発ルールは [AGENTS.md](../AGENTS.md) に従い、作業内容に関係する節を参照してください。

## 情報の参照先

| 確認する情報 | 参照先 |
|---|---|
| Node.jsのバージョン | [.node-version](../.node-version)。Volta設定は [package.json](../package.json) |
| 依存関係・実行コマンド | [package.json](../package.json)、解決済みバージョンは [package-lock.json](../package-lock.json) |
| 開発ポート・ベースパス・エイリアス | [vite.config.ts](../vite.config.ts) |
| テスト環境 | [vitest.config.ts](../vitest.config.ts) |
| ビルド・GitHub Pagesへの公開手順 | [build.yml](../.github/workflows/build.yml) |
| 利用者向けの操作説明 | [Usage.md](../Usage.md) |

## 開発と検証

リポジトリのルートで実行します。

```sh
npm ci                 # ロックファイルに従って依存関係を導入
npm run dev            # 開発サーバーを起動
npm run typecheck      # Vue SFCを含む型チェック（vue-tsc --noEmit）
npm test               # Vitestでテストを実行
npm run build          # distへ本番用ファイルを生成
npm run preview        # 生成した本番用ファイルをローカルで確認
```

開発サーバーの設定ポートは3000、既定のベースパスは `/chart-editor/` です。通常の開発URLは `http://localhost:3000/chart-editor/` です。実際の接続先は設定と起動ログで確認してください。ベースパスは `BASE_URL` で変更できます。

型チェックにはVueファイルも対象にする `npm run typecheck` を使います。検証範囲は [共通ルール](../AGENTS.md)と変更内容に合わせ、文書だけの変更でアプリ全体の操作確認を必須にはしません。ビルド警告は実行結果に基づいて評価し、特定の警告が常に発生する、またはすべて無害とは扱わないでください。

## 作業対象の探し方

| 変更する機能 | 主な参照先 |
|---|---|
| 画面と操作の接続 | [App.vue](../src/App.vue) |
| 譜面データ・難易度・正規化 | [useChartData.ts](../src/composables/useChartData.ts) |
| 仮配置・挿入・選択操作 | [useNoteEditor.ts](../src/composables/useNoteEditor.ts)、[useSelection.ts](../src/composables/useSelection.ts) |
| Undo／Redo・入力の履歴 | [useChartHistory.ts](../src/composables/useChartHistory.ts)、[useHistoryField.ts](../src/composables/useHistoryField.ts) |
| ショートカット・型付き操作の提供 | [useEditorShortcuts.ts](../src/composables/useEditorShortcuts.ts)、[injectionKeys.ts](../src/composables/injectionKeys.ts) |
| ドラッグと移動計算 | [useNoteDrag.ts](../src/composables/useNoteDrag.ts)、[noteMovement.ts](../src/composables/noteMovement.ts) |
| 再生・音声・表示 | [Preview.vue](../src/components/Preview.vue) と `usePreview*` composables |
| JSON・音源の読み込みと保存 | [useFileIO.ts](../src/composables/useFileIO.ts) |
| 共通型・種別・検証 | [types.d.ts](../src/types.d.ts)、[useNoteTypes.ts](../src/composables/useNoteTypes.ts)、[useNoteCheck.ts](../src/composables/useNoteCheck.ts) |

ロジックのテストは `src/composables/__tests__/`、画面操作のテストは `src/components/__tests__/` を参照してください。ファイル一覧は作業時に検索し、必要な実装とテストを確認します。

## 実装上の注意点

| 守る条件 | 理由 | 推奨する方法 |
|---|---|---|
| 現在のVuetifyのAPIと型を使う | 古いコンポーネントやイベントの記法を混ぜないため | メニュー等のactivatorは `{ props }` と `v-bind="props"` を使い、不明なプロパティは導入済みパッケージの定義で確認する |
| ファイル入力の値を正しく受け取る | DOMイベントとは引数が異なるため | `@update:model-value` から既存の `readFile` を呼ぶ。引数は `File`、配列、未選択を考慮する |
| VueのProxyを直接structuredCloneへ渡さない | 複製時の例外を防ぐため | `useNoteEditor.ts` の `toRaw` を使う処理や、履歴管理の複製処理を参照する |
| レーンやノーツの条件を種別に合わせる | 一律の範囲ではロング・制御オブジェクト等を誤処理するため | `chart-types`、`useNoteCheck.ts`、`noteMovement.ts` の既存ルールを確認し、テストデータにも適切な型を付ける |
| 設定ファイルをESMとして扱う | CommonJS用のパス解決を混ぜないため | エイリアス等のパスは、既存設定と同じ `fileURLToPath(new URL(..., import.meta.url))` を使う |

## 外部リソース

フォント・アイコンの読み込み先は [index.html](../index.html)、テクスチャAPIは [useTextureDB.ts](../src/composables/useTextureDB.ts) を参照してください。接続先を別の文書へ固定で複製せず、失敗時は影響する機能とエラー内容を確認します。

## 画面確認

画面を変更した場合は、対象のフローに応じて次の操作を確認します。

- 仮配置から確定挿入し、Undo／Redoで戻せること。
- 難易度を切り替えても、別の難易度のデータを意図せず変更しないこと。
- ショートカットやメニューを変更した場合は、入力中・IME・Escの競合がないこと。
- 再生やレイアウトを変更した場合は、停止・スクロール復帰・左右／上下表示が正しいこと。
