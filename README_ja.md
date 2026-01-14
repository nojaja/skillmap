# skillmap

**Skyrim（スカイリム）** の魔法スキルツリーにインスパイアされた、**スキル習得シミュレーター**。Vue 3 + Vite + Pinia + Tailwind CSS で構築。すべてのデータをブラウザ内（Service Worker + OPFS）に保存し、外部バックエンドなしで完全に動作します。

🌐 **[ライブデモ](https://nojaja.github.io/skillmap/?skillTreeUrl=https%3A%2F%2Fgist.githubusercontent.com%2Fnojaja%2F019ae39c7317287b2ae9991d8496edb9%2Fraw%2F049161f078ce4b4e70af9566132cb66e5612521e%2Fdestruction_magic)** 

## プロジェクト概要

skillmapは、任意の**スキルツリー**（スキルノード＆接続関係）を作成・編集・シミュレートするWebアプリケーションです。

### 主な特徴
- 📊 **スキル習得シミュレーション** - ツリーをインタラクティブに探索し、スキルアンロック条件を確認
- ✏️ **エディタモード** - スキルノードの追加・編集・削除、依存関係の管理
- 💾 **ローカルストレージ** - Service Worker + Origin Private File System（OPFS）でデータを永続化
- 📤 **エクスポート/インポート** - JSON形式でスキルツリーを保存・共有
- 🎨 **視覚的な配置** - SVG キャンバスでスキルの空間配置を直感的に編集
- 📱 **レスポンシブ** - デスクトップからタブレットまで対応
- ⚡ **Zero Backend** - 外部サーバ依存なし、すべてクライアント側で完結

## プロジェクト構成

このプロジェクトは **2つの独立したモジュール**で構成されています：

### 1. Frontend（Vue 3 SPA）
```
frontend/
├── src/
│   ├── App.vue                  # ルートコンポーネント
│   ├── main.ts                  # Vite エントリポイント
│   ├── components/
│   │   ├── SkillConstellation.vue    # スキルツリー表示（SVGキャンバス）
│   │   ├── SkillEditorPanel.vue      # スキル編集パネル
│   │   ├── SkyView.vue              # ビュー管理（ズーム・パン）
│   │   ├── SkillCollectionModal.vue  # スキルツリー管理ダイアログ
│   │   └── ...
│   ├── services/
│   │   ├── browserApiAdapter.ts     # Service Worker IPC ブリッジ
│   │   └── skillNormalizer.ts       # データ正規化
│   ├── stores/
│   │   └── skillStore.ts            # Pinia ストア（状態管理）
│   ├── types/
│   │   └── skill.ts                 # 型定義
│   └── utils/
│       └── grid.ts                  # グリッドスナップ
├── test/unit/                       # Jest ユニットテスト
└── package.json
```

### 2. Service Worker（TypeScript WebWorker）
```
service-worker/
├── src/
│   ├── sw.ts                        # エントリポイント
│   ├── application/
│   │   ├── skillTreeService.ts      # ビジネスロジック
│   │   ├── skillTreeRepository.ts   # リポジトリ層
│   │   └── ...
│   ├── domain/
│   │   ├── skillTypes.ts            # ドメイン型定義
│   │   └── skillNormalizer.ts       # ドメイン正規化
│   ├── infrastructure/
│   │   ├── cache/
│   │   │   └── skillTreeCache.ts    # メモリキャッシュ
│   │   ├── opfs/
│   │   │   ├── opfsClient.ts        # OPFS I/O
│   │   │   └── fileStore.ts         # ファイル管理
│   │   └── notification/
│   │       └── broadcastChannelGateway.ts
│   ├── service/
│   │   ├── swAdapter.ts             # メッセージハンドラ
│   │   └── swLifecycle.ts           # SW ライフサイクル
│   └── test/unit/                   # Jest ユニットテスト
└── package.json
```

## 技術スタック

### Frontend
| 技術 | バージョン | 用途 |
|------|-----------|------|
| Vue 3 | ^3.5.24 | フレームワーク |
| TypeScript | ^5.4.5 | 型付き開発 |
| Vite | ^7.2.4 | バンドラ・開発サーバ |
| Pinia | ^3.0.4 | 状態管理 |
| Tailwind CSS | ^3.4.17 | UI スタイリング |
| Axios | ^1.13.2 | HTTP クライアント |

### Service Worker
| 技術 | バージョン | 用途 |
|------|-----------|------|
| TypeScript | ^5.4.5 | 型付き開発 |
| OPFS API | - | ローカルストレージ |
| BroadcastChannel API | - | プロセス間通信 |

### 開発ツール
| ツール | バージョン | 用途 |
|--------|-----------|------|
| Jest | ^29.6.1 | ユニットテスト |
| ESLint | ^8.57.0 | Lint |
| TypeDoc | ^0.28.0 | API ドキュメント生成 |
| dependency-cruiser | ^16.9.0 | 依存関係分析 |

## セットアップ

### 前提条件
- Node.js v22 以上
- npm v10 以上

### インストール
```bash
# プロジェクトをクローン
git clone https://github.com/nojaja/skillmap.git
cd skillmap/master01

# Frontend のセットアップ
cd frontend
npm install

# Service Worker のセットアップ
cd ../service-worker
npm install
```

## 使用方法

### Webアプリケーション（開発）
```bash
cd frontend
npm run dev
```
- ブラウザで `http://localhost:5173` にアクセス
- Vite の Hot Module Replacement（HMR）により、ファイル変更時に自動リロード

### Webアプリケーション（ビルド）
```bash
cd frontend
npm run build
```
- `dist/` ディレクトリに本番用バンドルを出力
- Service Worker は自動的にコンパイルされ `public/sw.js` に出力

### テスト実行

#### Frontend ユニットテスト
```bash
cd frontend
npm run test                    # テスト実行
npm run test:ci               # カバレッジ報告付き
```

#### Service Worker ユニットテスト
```bash
cd service-worker
npm run test                   # テスト実行
npm run test:ci              # カバレッジ報告付き
```

### Lint / 型チェック
```bash
# Frontend
cd frontend
npm run lint                  # ESLint 実行
npm run build                 # TypeScript コンパイルチェック

# Service Worker
cd service-worker
npm run lint                  # ESLint 実行
```

### ドキュメント生成
```bash
# API ドキュメント（Markdown）
npm run docs
```

### 依存関係分析
```bash
npm run depcruise            # 依存グラフを分析
```

## 主な機能

### 1. スキルツリー表示・シミュレーション
- **SVGキャンバス** でスキルノードを視覚的に配置
- **ズーム・パン** でキャンバス操作
- ノードタップでスキル詳細表示
- **依存関係の自動解析** - 選択スキルの前提条件を可視化

### 2. スキルツリー編集
- ✏️ **ノード追加** - キャンバス上の任意の位置に新規スキルを追加
- 🗑️ **ノード削除** - 選択ノードを削除（孤立ノードチェック付き）
- 🔗 **依存関係管理** - AND / OR ロジックでスキル前提条件を定義
- 📍 **空間配置** - ドラッグ&ドロップでノード位置を変更

### 3. スキルツリー管理
- 📂 **複数ツリー保存** - 複数のスキルツリーを管理
- 💾 **JSON エクスポート** - ツリーをファイル出力
- 📥 **JSON インポート** - ファイルから読み込み
- 🔄 **同期** - 複数タブ間での自動同期（BroadcastChannel API）

### 4. ローカル永続化
- **Service Worker + OPFS** - ブラウザのオリジン プライベート ファイル システムに保存
- ⚡ **オフライン対応** - ネットワーク接続なしで利用可能
- 🔐 **プライベート** - データはオリジンごとに隔離

## 現在の実装状況

### ✅ 完了機能
- SVGベースのスキルツリー可視化
- エディタモード（ノード追加・削除・編集）
- 依存関係管理（AND/OR ロジック）
- Service Worker 統合
- OPFS を用いたローカルストレージ
- 複数タブ間同期（BroadcastChannel）
- JSON エクスポート/インポート
- Pinia 状態管理
- Vite 開発サーバ・ビルドフロー
- ユニットテスト（Jest）

### ⚠️ 実験的機能
- **スキルポイント機構** (`SKILL_POINT_SYSTEM_ENABLED = false`)
  - 有効化するとスキルアンロック時に消費ポイント機構が動作
  - 現在は無効化されているため、すべてのスキルは即座にアンロック可能

### 📋 今後の検討事項
- [ ] モバイル UI の最適化
- [ ] スキルツリーテンプレート機能
- [ ] Undo/Redo 機構
- [ ] スキルツリーのバージョン管理
- [ ] クラウド同期（オプション）
- [ ] 複数ユーザーコラボレーション

## アーキテクチャ

### 層別設計
```
┌─────────────────────────────────┐
│  Vue Components (Presentation)  │  UI層
├─────────────────────────────────┤
│  Pinia Store (State Management) │  状態層
├─────────────────────────────────┤
│  Service Adapter (IPC Bridge)   │  通信層
├─────────────────────────────────┤
│  Service Worker (Backend)       │  ワーカー層
│  ├─ Application Layer           │    ビジネスロジック
│  ├─ Domain Layer                │    ドメインモデル
│  └─ Infrastructure Layer        │    OPFS/Cache
└─────────────────────────────────┘
```

### 通信フロー
1. **UI ユーザー操作** → Vue コンポーネント
2. **状態更新** → Pinia ストア
3. **メッセージ送信** → Service Adapter（`postMessage`）
4. **バックエンド処理** → Service Worker（ビジネスロジック）
5. **ストレージ操作** → OPFS / キャッシュ層
6. **結果返送** → メッセージハンドラ → Pinia
7. **UI 反映** → Vue の反応性

## 開発ワークフロー

### ローカル開発
```bash
# ターミナル 1: Frontend 開発サーバ
cd frontend
npm run dev

# ターミナル 2: テスト監視モード（オプション）
cd frontend
npm run test -- --watch
```

### ビルド & デプロイ
```bash
# ビルド
cd frontend
npm run build

# 出力先確認
ls -la dist/

# GitHub Pages への自動デプロイ（CI/CD設定済み）
# ➜ https://nojaja.github.io/skillmap/
```

### テスト駆動開発
```bash
# テスト実行
npm run test

# カバレッジレポート生成
npm run test:ci

# 結果確認
open coverage/frontend/lcov-report/index.html
```

## パフォーマンス・目標

- **バンドルサイズ**: ~500 KB（gzip 後 ~150 KB）
- **初期ロード時間**: < 1 秒（キャッシュ後）
- **テストカバレッジ**: > 80%（継続改善中）
- **アクセシビリティ**: WCAG 2.1 AA 対応予定

## トラブルシューティング

### Service Worker が登録されない
```bash
# ブラウザのキャッシュをクリア
# DevTools → Application → Clear site data
```

### OPFS が利用できない
```bash
# 対応ブラウザを確認（Chrome 124+、Edge など）
# Incognito/Private モードでは利用不可
```

### テストが失敗する
```bash
# node_modules をリセット
rm -rf node_modules package-lock.json
npm install
npm run test
```

## ライセンス

このプロジェクトは **MIT License** の下で公開されています。  
詳細は [LICENSE](LICENSE) を参照してください。

## 作成者

**nojaja** - [GitHub Profile](https://github.com/nojaja)

---

**関連リソース**
- 📖 [アーキテクチャドキュメント](docs/architecture/)
- 🛠️ [開発ドキュメント](docs/steering/)
- 📚 [API ドキュメント](docs/typedoc-md/)
