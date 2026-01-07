---
inclusion: always
---

# 技術スタック

* 言語 / ランタイム:
  * フロント: Vue 3 + TypeScript + Vite
  * バック: なし（外部API連携を廃止しブラウザ完結）
* 主要ライブラリ（依存に基づく）:
  * vue ^3.5.24, pinia ^3.0.4, axios ^1.13.2, qrcode ^1.5.4
  * 開発: vite ^7.2.4, @vitejs/plugin-vue ^6.0.1, typescript ^5.4.5, tailwindcss ^3.4.17, jest ^29.6.1, ts-jest ^29.1.0
* データベース / ストレージ:
  * Service Worker + OPFS によるローカル永続化（サーバーDBなし）
* テスト / CI:
  * テストフレームワーク: Jest（npm scripts: test, test:ci）
  * CI: UNKNOWN（.github/workflows等のCI設定は未確認）
* デプロイ / Infra（Docker/K8s etc）:
  * UNKNOWN（Dockerfileやデプロイ設定ファイルは未確認）
* 制約／ポリシー（セキュリティ、互換性等）:
  * ESM `type: module` フロントエンド、Viteビルド、Tailwind/PostCSSを使用
* 出典（extracted from）:
  * README.md
  * frontend/package.json
  * frontend/README.md
