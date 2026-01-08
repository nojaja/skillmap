---
inclusion: always
---

# プロジェクト構造

* ルートの主なディレクトリ:
  * /frontend -> Vue 3 + Viteフロントエンド（src/components, stores, services, types, utils を含む）
  * /docs -> typedoc生成物や steering docs 用ディレクトリ
  * /coverage -> フロント/サーバー両方の既存カバレッジ出力
  * /test -> frontend向けユニットテストとモック
  * /packages -> NONE
* コンポーネント / モジュール配置規約:
  * Vueコンポーネント: frontend/src/components/*.vue（PascalCaseファイル）
  * 状態管理: frontend/src/stores/skillStore.ts（Piniaストア）
  * サービス/ユーティリティ: frontend/src/services/*.ts, frontend/src/utils/*.ts
* 命名規約 / スタイル規約:
  * コンポーネントはPascalCase.vue、ユーティリティやサービスはkebab-caseまたはlowerCamelの.ts
  * ESM import/exportとTypeScriptベース
* テストの場所と命名:
  * Jestユニットテスト: test/unit/frontend/**/*.test.ts
  * モック: test/mocks/**
* 重要なファイルパターン（fileMatch）:
  * "frontend/src/**/*.vue", "frontend/src/**/*.ts", "test/unit/**/*.test.ts"
* 出典（extracted from）:
  * README.md
  * frontend/package.json
  * frontend/README.md
  * フォルダ構成（workspace tree）
