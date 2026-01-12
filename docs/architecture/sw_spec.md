# Skillmap Service Worker Architecture Spec (sw_spec.md)

## 目的
- 既存の `frontend/src/service-worker/sw.ts` に混在する責務（型・正規化・OPFS I/O・ユースケース・SW統合）をクリーンアーキテクチャで分割し、可読性・テスト容易性・変更容易性を高める。
- 配置は `frontend/src/sw/` 配下に再構築する。

## スコープ
- Service Worker 内でのスキルツリーとステータスの取得・保存・一覧・輸出入・削除・通知（BroadcastChannel）
- OPFS（Origin Private File System）での永続化

## 採用方針（決定事項）
- 配置ルート: `frontend/src/sw/`
- キャッシュ管理: インフラ層に配置（`infrastructure/cache/skillTreeCache.ts`）
- BroadcastChannel通知: 案B（ユースケース完了時にアプリ層からイベント発火、実装はインフラへDI）
- 既存 `frontend/src/types/skill.ts` との連携: 案2（SW専用型を別定義し、UI型⇄SW型の変換関数を用意）

## フォルダ構成
```
frontend/src/sw/
  domain/
    skillNormalizer.ts        # 正規化・検証ロジック（sanitize, normalize, mergeByUpdatedAt）
    skillTypes.ts             # SW専用ドメイン型（SkillNode/Tree/Status/Summaryなど）
  application/
    skillTreeRepository.ts    # リポジトリIF（Tree/Statusの読み書き・一覧・削除）
    skillTreeService.ts       # ツリーのユースケース（get/save/export/import/delete/list）
    skillStatusService.ts     # ステータスのユースケース（get/save）
    eventPublisher.ts         # 抽象イベントパブリッシャ（案B）
  infrastructure/
    opfs/
      opfsClient.ts           # OPFS低レベル操作（getDirectory/ensureDir）
      fileStore.ts            # JSON読み書き共通（readJsonFile/writeJsonFile）
    cache/
      skillTreeCache.ts       # メモリキャッシュ（list同期、put/evict/get）
    notification/
      broadcastChannelGateway.ts # EventPublisher実装（BroadcastChannel）
    skillTreeRepositoryImpl.ts # OPFS+正規化+キャッシュのリポジトリ実装
  service/
    swLifecycle.ts            # install/activate（ensureDefaultTree, cache初期化）
    swAdapter.ts              # SWのmessage受付・handlers振り分け・ request検証
  sw.ts                       # エントリ（リスナー登録のみで簡潔）
```

## 責務マッピング（既存 `sw.ts` からの移行）
- domain/skillNormalizer.ts
  - `isoNow`, `normalizeUpdatedAt`, `isStringArray`, `normalizeVersion`, `normalizeSourceEtag`, `sanitizeTreeId`
  - `normalizeNodes`（内部: `normalizeNode`, `extractAndNormalizeReqs`, `normalizeName`）
  - `normalizeConnections`（内部: `validateConnection`, `isValidConnectionPair`, `createConnectionKey`）
  - `mergeByUpdatedAt`
- infrastructure/opfs/
  - `getRoot`, `ensureDir`, `readJsonFile`, `writeJsonFile`
- infrastructure/skillTreeRepositoryImpl.ts
  - `readSkillTreeFile`, `writeSkillTreeFile`, `readStatusFile`, `writeStatusFile`, `listSkillTreeFiles`
- infrastructure/cache/skillTreeCache.ts
  - `refreshSkillTreeCacheFromDisk` 相当の機能を `list()` 呼び出し時に同期/更新
- infrastructure/notification/broadcastChannelGateway.ts
  - 既存の `broadcastChannel.postMessage(...)` を EventPublisher 実装に委譲
- service/swLifecycle.ts
  - `install`, `activate`（`ensureDefaultTree` + `clients.claim()`）
- application/
  - `handleGetSkillTree`, `handleSaveSkillTree`, `handleExportSkillTree`, `handleImportSkillTree`, `handleDeleteSkillTree`, `handleListSkillTrees`
  - `handleGetStatus`, `handleSaveStatus`
- service/swAdapter.ts
  - `processRequest`（request検証・handler実行・応答生成）
  - `message` イベントリスナ（`sanitizeTreeId` を用いた treeId解決）

## 主要インターフェース（抜粋）
```ts
// frontend/src/sw/domain/skillTypes.ts
export type ReqMode = 'and' | 'or'
export type SwSkillNode = {
  id: string; x: number; y: number; name: string; cost: number;
  description: string; reqs: string[]; reqMode: ReqMode;
}
export type SwSkillTree = {
  id: string; name: string; nodes: SwSkillNode[]; connections: { from: string; to: string }[];
  updatedAt: string; version: number; sourceUrl?: string; sourceEtag?: string;
}
export type SwSkillStatus = {
  treeId: string; availablePoints: number; unlockedSkillIds: string[]; updatedAt: string;
}
export type SwSkillTreeSummary = {
  id: string; name: string; updatedAt: string; nodeCount: number; sourceUrl?: string;
}
```

```ts
// frontend/src/sw/application/skillTreeRepository.ts
import { SwSkillTree, SwSkillStatus, SwSkillTreeSummary } from '../domain/skillTypes'

export interface SkillTreeRepository {
  getTree(treeId: string, fallback?: Partial<SwSkillTree>): Promise<SwSkillTree>
  saveTree(treeId: string, incoming: Partial<SwSkillTree>): Promise<SwSkillTree>
  exportTree(treeId: string, fallback?: Partial<SwSkillTree>): Promise<SwSkillTree>
  importTree(treeId: string, tree: Partial<SwSkillTree>): Promise<SwSkillTree>
  deleteTree(treeId: string): Promise<{ ok: boolean }>
  listTrees(): Promise<SwSkillTreeSummary[]>

  getStatus(treeId: string, fallback?: Partial<SwSkillStatus>): Promise<SwSkillStatus>
  saveStatus(treeId: string, incoming: Partial<SwSkillStatus>): Promise<SwSkillStatus>
}
```

```ts
// frontend/src/sw/application/eventPublisher.ts
export type SkillEvent =
  | { type: 'skill-tree-updated'; treeId: string; updatedAt: string }
  | { type: 'status-updated'; treeId: string; updatedAt: string }
  | { type: 'skill-tree-deleted'; treeId: string; updatedAt: string }

export interface NotificationGateway {
  publish(event: SkillEvent): void
}
```

## BroadcastChannel（案B）設計
- EventPublisher（`NotificationGateway`）をインフラ層で実装（BroadcastChannelベース）。
- アプリケーション層のユースケース完了時に `gateway.publish(...)` を呼ぶ。
- メリット: ユースケース単位で通知ポリシー制御（保存・削除のみ通知、debounceなど）。テスト時はモック差し替え可能。
- デメリット: 実装レイヤが増える（インフラDIが必要）。I/O層の自動通知との重複に注意。

## 既存 `frontend/src/types/skill.ts` との連携（案2）
- SW専用型（`SwSkillNode/Tree/Status/Summary`）を `domain/skillTypes.ts` に定義。
- 変換関数（例）を `domain/skillNormalizer.ts` もしくは `application/converters.ts` に配置。
  - `toUiSkillTree(sw: SwSkillTree): UiSkillTree`
  - `fromUiSkillTree(ui: UiSkillTree): SwSkillTree`
  - `toUiSkillStatus(sw: SwSkillStatus): UiSkillStatus`
  - `fromUiSkillStatus(ui: UiSkillStatus): SwSkillStatus`
- メリット: 境界が明確、SWの進化をUIから独立させられる。
- デメリット: 型重複と変換コストが発生。両型の変更同期が必要。

## ユースケースフロー（例: save-skill-tree）
1. SWが `message` イベント受信 → `swAdapter` が `processRequest` を実行
2. `skillTreeService.save(treeId, payload)` 呼び出し
3. Repository（`skillTreeRepositoryImpl`）で:
   - 正規化（`skillNormalizer`）
   - 既存値読み込み（OPFS）
   - `mergeByUpdatedAt` でマージ → 保存（OPFS）
   - キャッシュ更新（`skillTreeCache`）
4. ユースケースが `notificationGateway.publish({ type: 'skill-tree-updated', treeId, updatedAt })`
5. 応答 `{ ok: true, data: ... }` を返却

## エラー処理・バリデーション
- `sanitizeTreeId` による安全なID（`^[A-Za-z0-9_-]{1,64}$`）。
- `normalizeUpdatedAt` は無効値をフォールバック（`isoNow()`）。
- `normalizeVersion` は `>= 1` の整数のみ許容。
- `normalizeNodes/Connections` は重複・自己参照・存在しないノード参照を除外。
- OPFS I/O 例外は `NotFoundError` のみ静かにフォールバック、それ以外は `console.error` ログ。

## セキュリティ考慮
- パストラバーサル対策：OPFSはハンドルベースだが、ファイル名は `sanitizeTreeId` を通し、任意文字列を許容しない。
- エラーメッセージ：内部情報の過剰露出を避け、日本語ログで抑制。

## テスト戦略（Jest+ESM）
- ユニットテストは `test/unit/frontend/sw/**` に配置。
- `skillNormalizer`：正常系・異常系網羅（HTTP不要）。
- Repository：OPFSの read/write をモック化。`list` はパース異常・NotFoundを含め検証。
- ユースケース：NotificationGateway をモックし、発火条件を検証。
- 参考: 既存の Jest 設定（`frontend/jest.config.js`）に準拠。

## 段階的移行計画
1. 抽象IF（`skillTreeRepository.ts`, `eventPublisher.ts`）と SW専用型（`skillTypes.ts`）作成
2. `skillTreeRepositoryImpl.ts` を最小実装（get/save/list）で切り出し
3. `swAdapter.ts` を導入し、既存 `handlers` をユースケースへ差し替え
4. BroadcastChannel実装（`broadcastChannelGateway.ts`）をDI（ユースケースへ渡す）
5. 変換関数のユニットテストを追加し、UI型連携を確認
6. 既存 `service-worker/sw.ts` を `sw.ts`（新エントリ）へ段階移行

## 受け入れ基準（例）
- `save-skill-tree` 実行で OPFS 保存・キャッシュ更新・通知発火が行われること。
- `list-skill-trees` が更新日時降順・nodeCount 正確性を満たすこと。
- 異常系（破損JSON/NotFound）でもフォールバックで動作継続すること。
- すべてのロジックがユニットテストで80%以上のカバレッジ（既存方針）を満たすこと。
