import { defineStore } from 'pinia'

import {
  defaultSkillTree,
  normalizeConnections,
  normalizeNodes,
  normalizeSkillTree,
  normalizeStatus,
} from '../services/skillNormalizer'
import {
  ensureServiceWorker,
  exportSkillTreeFromSW,
  deleteSkillTreeFromSW,
  getSkillTreeFromSW,
  getStatusFromSW,
  importSkillTreeToSW,
  listSkillTreesFromSW,
  saveSkillTreeToSW,
  saveStatusToSW,
  subscribeSyncEvents,
} from '../services/browserApiAdapter'
import {
  DEFAULT_AVAILABLE_POINTS,
  type SkillDraft,
  type SkillNode,
  type SkillStatus,
  type SkillTreeSummary,
  type SkillTree,
} from '../types/skill'

export const SKILL_POINT_SYSTEM_ENABLED = false

export { normalizeConnections, normalizeNodes, normalizeSkillTree } from '../services/skillNormalizer'
export type { SkillConnection, SkillDraft, SkillNode, SkillStatus, SkillTree } from '../types/skill'

const cloneSkillTree = (tree: SkillTree): SkillTree => ({
  ...tree,
  nodes: tree.nodes.map((node) => ({
    ...node,
    reqs: node.reqs ? [...node.reqs] : [],
    reqMode: node.reqMode ?? 'and',
  })),
  connections: tree.connections.map((connection) => ({ ...connection })),
  version: tree.version ?? 1,
  sourceEtag: tree.sourceEtag,
})

const toSerializableSkillTree = (tree: SkillTree): SkillTree => {
  // structuredCloneがProxyを含む場合に失敗するため、常にJSON経由でシリアライズ可能な形にする
  return JSON.parse(JSON.stringify(tree)) as SkillTree
}

const toSerializableStatus = (status: SkillStatus): SkillStatus => {
  return JSON.parse(JSON.stringify(status)) as SkillStatus
}

export const useSkillStore = defineStore('skill', {
  state: () => ({
    currentTreeId: defaultSkillTree.id,
    availablePoints: DEFAULT_AVAILABLE_POINTS,
    unlockedSkillIds: [] as string[],
    skillTreeData: cloneSkillTree(defaultSkillTree),
    statusUpdatedAt: defaultSkillTree.updatedAt,
    skillTreeUpdatedAt: defaultSkillTree.updatedAt,
    availableSkillTrees: [] as SkillTreeSummary[],
    collectionLoading: false,
    loading: false,
    editMode: false,
    selectedSkillIds: [] as string[],
    activeSkillId: null as string | null,
    dependencyInputFocused: false,
    dependencyInputSelectedId: null as string | null,
    dependencyInputSelectionToken: 0,
    syncUnsubscribe: null as null | (() => void),
  }),
  getters: {
    /**
     * 処理名: アクティブスキル取得
     *
     * 処理概要: 現在選択中のスキルIDに紐づくノードを返し、見つからない場合はnullを返却する。
     *
     * 実装理由: 画面表示や編集操作で現在の対象スキルを簡潔に参照するため。
     */
    activeSkill(state): SkillNode | null {
      return state.skillTreeData.nodes.find((node) => node.id === state.activeSkillId) ?? null
    },
  },
  actions: {
    setupSyncListener() {
      if (this.syncUnsubscribe) return
      this.syncUnsubscribe = subscribeSyncEvents((payload) => {
        const defaultEntry: SkillTreeSummary = {
          id: defaultSkillTree.id,
          name: defaultSkillTree.name,
          updatedAt: defaultSkillTree.updatedAt,
          nodeCount: defaultSkillTree.nodes.length,
          sourceUrl: defaultSkillTree.sourceUrl,
        }

        const fallbackMerged = [defaultEntry]
        if (this.skillTreeData?.id) {
          fallbackMerged.push({
            id: this.skillTreeData.id,
            name: this.skillTreeData.name,
            updatedAt: this.skillTreeData.updatedAt,
            nodeCount: this.skillTreeData.nodes.length,
            sourceUrl: this.skillTreeData.sourceUrl,
          })
        }
        const unique = new Map<string, SkillTreeSummary>()
        fallbackMerged.forEach((item) => unique.set(item.id, item))
        this.availableSkillTrees = Array.from(unique.values())
        if (payload.event === 'skill-tree-updated') {
          void this.loadSkillTree(this.currentTreeId)
        }
        if (payload.event === 'status-updated') {
          void this.loadStatus(this.currentTreeId)
        }
      })
    },
    setTreeId(treeId: string) {
      const safeId = treeId?.trim() || defaultSkillTree.id
      this.currentTreeId = safeId
    },
    updateSkillTreeName(name: string) {
      if (!this.editMode) {
        return { ok: false, message: '編集モードでのみ更新できます' }
      }

      const trimmed = name?.trim() ?? ''
      if (!trimmed) {
        return { ok: false, message: 'スキルツリー名を入力してください' }
      }

      this.skillTreeData.name = trimmed
      this.skillTreeUpdatedAt = new Date().toISOString()
      return { ok: true }
    },
    /**
     * 処理名: 空き座標の算出
     *
     * 処理概要: 指定座標を基点に既存ノードと重ならない最寄りのグリッド位置を探索して返す。
     *
     * 実装理由: 新規スキル配置時の視認性と整合性を確保するため。
     */
    findNonOverlappingPosition(startX: number, startY: number) {
      const baseX = Math.round(startX)
      const baseY = Math.round(startY)

      const occupied = new Set(this.skillTreeData.nodes.map((node) => `${Math.round(node.x)},${Math.round(node.y)}`))
      const isFree = (x: number, y: number) => !occupied.has(`${x},${y}`)

      if (isFree(baseX, baseY)) return { x: baseX, y: baseY }

      // 同一座標のみを衝突とみなし、近傍グリッドを外側へ探索する
      const step = 20
      const maxRadius = 50

      for (let radius = 1; radius <= maxRadius; radius++) {
        const offset = radius * step

        // 上辺/下辺
        for (let dx = -offset; dx <= offset; dx += step) {
          const x1 = baseX + dx
          const y1 = baseY - offset
          if (isFree(x1, y1)) return { x: x1, y: y1 }

          const x2 = baseX + dx
          const y2 = baseY + offset
          if (isFree(x2, y2)) return { x: x2, y: y2 }
        }

        // 左辺/右辺（角は上でチェック済みなので除外）
        for (let dy = -offset + step; dy <= offset - step; dy += step) {
          const x1 = baseX - offset
          const y1 = baseY + dy
          if (isFree(x1, y1)) return { x: x1, y: y1 }

          const x2 = baseX + offset
          const y2 = baseY + dy
          if (isFree(x2, y2)) return { x: x2, y: y2 }
        }
      }

      // 異常に密集している場合のフォールバック
      return { x: baseX + step, y: baseY + step }
    },
    /**
     * 処理名: スキルID生成
     *
     * 処理概要: UUIDを優先的に利用し、利用不可の場合は日時と乱数に基づくフォールバックIDを発行する。
     *
     * 実装理由: クライアント側で一意なIDを確保し、サーバーと競合しない追加操作を可能にするため。
     */
    generateSkillId() {
      const makeFallback = () => `skill-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
      }
      return makeFallback()
    },
    /**
     * 処理名: 前提スキル取得
     *
     * 処理概要: 指定スキルIDの前提スキル一覧を返却する。対象が無い場合は空配列を返す。
     *
     * 実装理由: アンロック可否判定や表示用に依存関係を即時参照するため。
     */
    getPrerequisites(skillId: string) {
      const node = this.skillTreeData.nodes.find((n) => n.id === skillId)
      if (!node) return []
      const reqsFromNode = Array.isArray(node.reqs) ? node.reqs : []
      const reqsFromConnections = this.skillTreeData.connections
        .filter((conn) => conn.to === skillId)
        .map((conn) => conn.from)

      return Array.from(new Set([...reqsFromNode, ...reqsFromConnections]))
    },
    /**
     * 処理名: アンロック判定
     *
     * 処理概要: 指定IDがアンロック済みかどうかを判定する。
     *
     * 実装理由: UI表示と操作制御の基礎判定として利用するため。
     */
    isUnlocked(skillId: string) {
      return this.unlockedSkillIds.includes(skillId)
    },
    /**
     * 処理名: 依存スキル取得
     *
     * 処理概要: 指定スキルを前提とするスキルIDを、接続情報と前提定義から統合して返す。
     *
     * 実装理由: 無効化可否や整合性チェックに必要な依存先を把握するため。
     */
    getDependents(skillId: string) {
      const fromConnections = this.skillTreeData.connections
        .filter((conn) => conn.from === skillId)
        .map((conn) => conn.to)

      const fromReqs = this.skillTreeData.nodes
        .filter((node) => this.getPrerequisites(node.id).includes(skillId))
        .map((node) => node.id)

      return Array.from(new Set([...fromConnections, ...fromReqs]))
    },
    /**
     * 処理名: 無効化可否判定
     *
     * 処理概要: 編集モード・アンロック状態・依存スキルの有無を確認し、無効化が可能か返す。
     *
     * 実装理由: 誤操作で依存関係を崩さないようにガードするため。
     */
    canDisable(skillId: string) {
      if (this.editMode) return false
      if (!this.isUnlocked(skillId)) return false
      const unlockedDependents = this.getDependents(skillId).filter((id) => this.isUnlocked(id))
      if (unlockedDependents.length > 0) return false
      return true
    },
    /**
     * 処理名: アンロック可否判定
     *
     * 処理概要: 編集モード、存在確認、ポイント残量、前提スキル達成を評価しアンロック可能か返す。
     *
     * 実装理由: UI操作時に許可/不許可を即時フィードバックするため。
     */
    canUnlock(skillId: string) {
      if (this.editMode) return false
      const node = this.skillTreeData.nodes.find((n) => n.id === skillId)
      if (!node) return false
      if (this.isUnlocked(skillId)) return false
      if (node.cost > this.availablePoints) return false
      const prereqs = this.getPrerequisites(skillId)
      const reqMode = node.reqMode ?? 'and'

      if (prereqs.length > 0) {
        const unlockedCount = prereqs.filter((req) => this.isUnlocked(req)).length
        if (reqMode === 'or') {
          if (unlockedCount === 0) return false
        } else {
          if (unlockedCount !== prereqs.length) return false
        }
      }
      return true
    },
    /**
     * 処理名: スキルアンロック
     *
     * 処理概要: 可否判定を通過したスキルをアンロックし、消費ポイントを減算する。
     *
     * 実装理由: ユーザー操作によるスキル取得を状態に反映するため。
     */
    unlockSkill(skillId: string) {
      if (this.editMode) return false
      const node = this.skillTreeData.nodes.find((n) => n.id === skillId)
      if (!node) return false
      if (!this.canUnlock(skillId)) return false

      this.availablePoints -= node.cost
      this.unlockedSkillIds.push(skillId)
      void this.saveProgress()
      return true
    },
    /**
     * 処理名: スキル無効化
     *
     * 処理概要: 依存が無いアンロック済みスキルを無効化し、消費ポイントを戻す。
     *
     * 実装理由: 取得スキルの取り消しを安全に行うため。
     */
    disableSkill(skillId: string) {
      if (this.editMode) return false
      const node = this.skillTreeData.nodes.find((n) => n.id === skillId)
      if (!node) return false
      if (!this.canDisable(skillId)) return false

      this.availablePoints += node.cost
      this.unlockedSkillIds = this.unlockedSkillIds.filter((id) => id !== skillId)
      void this.saveProgress()
      return true
    },
    /**
     * 処理名: 接続情報再構築
     *
     * 処理概要: 現在のノード集合から接続を正規化し直し、重複や欠損を除去する。
     *
     * 実装理由: ノードの追加・削除・移動後も整合性のあるグラフ構造を維持するため。
     */
    refreshConnections() {
      // reqsを唯一のソースとして接続を再構築し、古い接続を残さない
      this.skillTreeData.connections = normalizeConnections(this.skillTreeData.nodes, [])
    },
    /**
     * 処理名: 選択トグル
     *
     * 処理概要: 単独/複数選択モードに応じて選択状態を更新し、アクティブスキルも同期する。
     *
     * 実装理由: 編集モードでの複数選択と単一選択の操作性を維持するため。
     */
    toggleSelection(skillId: string, multiSelect: boolean) {
      if (!this.editMode) return

      if (!multiSelect) {
        this.selectedSkillIds = [skillId]
        this.activeSkillId = skillId
        return
      }

      const alreadySelected = this.selectedSkillIds.includes(skillId)
      this.selectedSkillIds = alreadySelected
        ? this.selectedSkillIds.filter((id) => id !== skillId)
        : [...this.selectedSkillIds, skillId]

      this.activeSkillId = this.selectedSkillIds[this.selectedSkillIds.length - 1] ?? null
    },
    /**
     * 処理名: アクティブスキル設定
     *
     * 処理概要: 指定IDをアクティブに設定し、未選択の場合は選択リストにも追加する。
     *
     * 実装理由: クリック/ショートカット操作でフォーカスと選択を同期させるため。
     */
    setActiveSkill(skillId: string | null) {
      this.activeSkillId = skillId
      if (skillId && !this.selectedSkillIds.includes(skillId)) {
        this.selectedSkillIds = [skillId]
      }
    },
    setDependencyInputFocus(focused: boolean) {
      this.dependencyInputFocused = focused
    },
    emitDependencyInputSelection(skillId: string) {
      if (!this.editMode) return
      if (!this.activeSkillId) return
      this.dependencyInputSelectedId = skillId
      this.dependencyInputSelectionToken += 1
    },
    /**
     * 処理名: 選択クリア
     *
     * 処理概要: 選択中およびアクティブなスキルを全て解除する。
     *
     * 実装理由: 編集完了やインポート直後に選択状態をリセットするため。
     */
    clearSelection() {
      this.selectedSkillIds = []
      this.activeSkillId = null
    },
    /**
     * 処理名: 選択からの新規スキル作成
     *
     * 処理概要: 選択中ノードの重心付近に新規スキルを配置し、依存関係を引き継ぐ。
     *
     * 実装理由: 既存スキルを起点に素早く派生スキルを追加できるようにするため。
     */
    createSkillFromSelection() {
      if (!this.editMode) {
        return { ok: false, message: '編集モードでのみ追加できます' }
      }

      const selectedNodes = this.skillTreeData.nodes.filter((node) => this.selectedSkillIds.includes(node.id))
      const x =
        selectedNodes.length > 0
          ? Math.round(selectedNodes.reduce((sum, node) => sum + node.x, 0) / selectedNodes.length)
          : 500
      const y =
        selectedNodes.length > 0
          ? Math.round(selectedNodes.reduce((sum, node) => sum + node.y, 0) / selectedNodes.length)
          : 400

      const position = this.findNonOverlappingPosition(x, y)

      const newId = this.generateSkillId()
      const result = this.addSkill({
        id: newId,
        name: '新規スキル',
        cost: 0,
        x: position.x,
        y: position.y,
        description: '',
        reqs: [...this.selectedSkillIds],
      })

      if (!result.ok) return result

      this.activeSkillId = newId
      this.selectedSkillIds = [newId]
      return { ...result, id: newId }
    },
    /**
     * 処理名: スキル追加
     *
     * 処理概要: 入力スキルを正規化し、ID重複を避けつつ新規ノードとして追加する。
     *
     * 実装理由: 編集モードでの新規登録を安全に受け付けるため。
     */
    addSkill(payload: SkillDraft) {
      if (!this.editMode) {
        return { ok: false, message: '編集モードでのみ追加できます' }
      }

      const candidateId = payload.id?.trim() || this.generateSkillId()

      const normalized = normalizeNodes([payload])
      if (normalized.length === 0) {
        return { ok: false, message: 'スキル情報が不正です' }
      }

      const normalizedSkill = normalized[0]
      if (!normalizedSkill) {
        return { ok: false, message: 'スキル情報が不正です' }
      }

      const normalizedSkillWithId: SkillNode = {
        ...normalizedSkill,
        id: candidateId,
      }

      const { x, y } = this.findNonOverlappingPosition(normalizedSkillWithId.x, normalizedSkillWithId.y)
      const normalizedSkillWithSafePosition: SkillNode = {
        ...normalizedSkillWithId,
        x,
        y,
      }

      if (this.skillTreeData.nodes.some((node) => node.id === normalizedSkillWithId.id)) {
        return { ok: false, message: '同じIDのスキルが既に存在します' }
      }

      this.skillTreeData.nodes.push(normalizedSkillWithSafePosition)
      this.refreshConnections()
      this.activeSkillId = normalizedSkillWithSafePosition.id
      this.selectedSkillIds = [normalizedSkillWithSafePosition.id]
      return { ok: true }
    },
    /**
     * 処理名: スキル更新
     *
     * 処理概要: 正規化した値で既存スキルを更新し、接続情報を再構築する。
     *
     * 実装理由: 編集パネルからの変更を状態に反映し、整合性を維持するため。
     */
    updateSkill(payload: SkillDraft) {
      if (!this.editMode) {
        return { ok: false, message: '編集モードでのみ更新できます' }
      }

      const candidateId = payload.id?.trim() || this.generateSkillId()

      const normalized = normalizeNodes([payload])
      if (normalized.length === 0) {
        return { ok: false, message: 'スキル情報が不正です' }
      }

      const normalizedSkillUpdate = normalized[0]
      if (!normalizedSkillUpdate) {
        return { ok: false, message: 'スキル情報が不正です' }
      }

      const normalizedSkillWithId: SkillNode = {
        ...normalizedSkillUpdate,
        id: candidateId,
      }

      const targetIndex = this.skillTreeData.nodes.findIndex((node) => node.id === payload.id)
      if (targetIndex === -1) {
        return { ok: false, message: '対象のスキルが見つかりません' }
      }

      this.skillTreeData.nodes[targetIndex] = {
        ...this.skillTreeData.nodes[targetIndex],
        ...normalizedSkillWithId,
      }
      this.refreshConnections()
      this.activeSkillId = payload.id
      return { ok: true }
    },
    /**
     * 処理名: スキル削除
     *
     * 処理概要: 対象スキルと関連接続・アンロック状態・選択状態を除去し、整合性を再構築する。
     *
     * 実装理由: 不要になったスキルを安全に取り除き、参照の残存を防ぐため。
     */
    removeSkill(skillId: string) {
      if (!this.editMode) {
        return { ok: false, message: '編集モードでのみ削除できます' }
      }

      const targetIndex = this.skillTreeData.nodes.findIndex((node) => node.id === skillId)
      if (targetIndex === -1) {
        return { ok: false, message: '削除対象のスキルが見つかりません' }
      }

      this.skillTreeData.nodes.splice(targetIndex, 1)
      this.skillTreeData.connections = this.skillTreeData.connections.filter(
        (connection) => connection.from !== skillId && connection.to !== skillId,
      )
      this.unlockedSkillIds = this.unlockedSkillIds.filter((id) => id !== skillId)
      this.selectedSkillIds = this.selectedSkillIds.filter((id) => id !== skillId)
      if (this.activeSkillId === skillId) {
        this.activeSkillId = this.selectedSkillIds[this.selectedSkillIds.length - 1] ?? null
      }
      this.refreshConnections()
      return { ok: true }
    },
    /**
     * 処理名: スキル移動
     *
     * 処理概要: 指定スキルの座標を丸めた上で更新し、接続を再計算する。
     *
     * 実装理由: ドラッグ操作に伴う表示位置変更と接続線更新を同期させるため。
     */
    moveSkill(skillId: string, x: number, y: number) {
      if (!this.editMode) return
      const target = this.skillTreeData.nodes.find((node) => node.id === skillId)
      if (!target) return

      target.x = Math.round(x)
      target.y = Math.round(y)
      this.refreshConnections()
    },
    async fetchSkillTreeCollection() {
      this.collectionLoading = true
      const defaultEntry: SkillTreeSummary = {
        id: defaultSkillTree.id,
        name: defaultSkillTree.name,
        updatedAt: defaultSkillTree.updatedAt,
        nodeCount: defaultSkillTree.nodes.length,
        sourceUrl: defaultSkillTree.sourceUrl,
      }

      try {
        await ensureServiceWorker()
        const list = await listSkillTreesFromSW()
        // 取得結果 + 既知キャッシュ + 現在ロード中 + デフォルトを統合
        const merged = [
          ...list,
          ...this.availableSkillTrees,
          defaultEntry,
        ]
        // 直近でロード済みのツリーを必ずリストに反映する（古いSWでlistが効かない場合のフォールバック）
        if (this.skillTreeData?.id) {
          merged.push({
            id: this.skillTreeData.id,
            name: this.skillTreeData.name,
            updatedAt: this.skillTreeData.updatedAt,
            nodeCount: this.skillTreeData.nodes.length,
            sourceUrl: this.skillTreeData.sourceUrl,
          })
        }
        const unique = new Map<string, SkillTreeSummary>()
        merged.forEach((item) => {
          const safeId = item.id?.trim() || defaultEntry.id
          unique.set(safeId, {
            id: safeId,
            name: item.name?.trim() || defaultEntry.name,
            updatedAt: item.updatedAt || defaultEntry.updatedAt,
            nodeCount: Number.isFinite(item.nodeCount) ? item.nodeCount : 0,
            sourceUrl: item.sourceUrl,
          })
        })

        this.availableSkillTrees = Array.from(unique.values()).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
      } catch (error) {
        console.error('スキルツリー一覧の取得に失敗しました', error)
        const fallbackMerged = [defaultEntry]
        // 既存キャッシュを保持
        fallbackMerged.push(...this.availableSkillTrees)
        if (this.skillTreeData?.id) {
          fallbackMerged.push({
            id: this.skillTreeData.id,
            name: this.skillTreeData.name,
            updatedAt: this.skillTreeData.updatedAt,
            nodeCount: this.skillTreeData.nodes.length,
            sourceUrl: this.skillTreeData.sourceUrl,
          })
        }
        const unique = new Map<string, SkillTreeSummary>()
        fallbackMerged.forEach((item) => unique.set(item.id, item))
        this.availableSkillTrees = Array.from(unique.values())
      } finally {
        this.collectionLoading = false
      }
    },
    async applyImportedSkillTree(tree: SkillTree) {
      await ensureServiceWorker()
      const incomingVersion = tree.version ?? 1

      let existing: SkillTree | null = null
      try {
        existing = await getSkillTreeFromSW(tree.id)
      } catch (error) {
        console.warn('既存スキルツリーの取得に失敗しました。新規として扱います', error)
      }

      if (existing) {
        const existingVersion = existing.version ?? 1

        if (incomingVersion < existingVersion) {
          const confirmed = window.confirm('同じIDのスキルツリーが存在します。上書きしますか？')
          if (!confirmed) {
            throw new Error('import-cancelled-version-older')
          }
        } else if (incomingVersion === existingVersion) {
          // 同一バージョンは更新不要
          return
        }
        // incomingVersion > existingVersion は確認なしで上書き
      }

      const imported = await importSkillTreeToSW(
        toSerializableSkillTree({ ...tree, updatedAt: new Date().toISOString() }),
      )
      this.skillTreeData = normalizeSkillTree(imported, defaultSkillTree)
      this.currentTreeId = this.skillTreeData.id
      this.skillTreeUpdatedAt = this.skillTreeData.updatedAt
      this.clearSelection()
      await this.loadStatus(this.currentTreeId)
      // ローカルにも即反映（SW list非対応時のフォールバック）
      const newEntry: SkillTreeSummary = {
        id: this.skillTreeData.id,
        name: this.skillTreeData.name,
        updatedAt: this.skillTreeData.updatedAt,
        nodeCount: this.skillTreeData.nodes.length,
        sourceUrl: this.skillTreeData.sourceUrl,
      }
      const merged = [...this.availableSkillTrees.filter((s) => s.id !== newEntry.id), newEntry]
      this.availableSkillTrees = merged.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      await this.fetchSkillTreeCollection()
    },
    /**
     * 処理名: スキルツリー読込
     *
     * 処理概要: APIからスキルツリーを取得し、正規化したうえで状態に反映する。失敗時は既定値を用いる。
     *
     * 実装理由: 初期表示やリロード時に最新データを取得しつつ、ネットワーク障害でも動作させるため。
     */
    async loadSkillTree(treeId?: string) {
      this.loading = true
      const targetTreeId = treeId?.trim() || this.currentTreeId || defaultSkillTree.id
      try {
        await ensureServiceWorker()
        const skillTree = await getSkillTreeFromSW(targetTreeId)
        this.skillTreeData = normalizeSkillTree(skillTree, defaultSkillTree)
        this.currentTreeId = this.skillTreeData.id
        this.skillTreeUpdatedAt = this.skillTreeData.updatedAt
        this.setupSyncListener()
      } catch (error) {
        console.error('スキルツリーの取得に失敗しました', error)
        this.skillTreeData = normalizeSkillTree({ id: targetTreeId }, defaultSkillTree)
        this.skillTreeUpdatedAt = this.skillTreeData.updatedAt
      } finally {
        this.loading = false
      }
    },
    /**
     * 処理名: スキルツリー保存
     *
     * 処理概要: 接続を正規化したうえでAPIに保存要求を送信する。
     *
     * 実装理由: 編集内容をサーバーへ永続化するため。
     */
    async saveSkillTree() {
      try {
        await ensureServiceWorker()
        this.refreshConnections()
        const nextVersion = (this.skillTreeData.version ?? 0) + 1
        this.skillTreeData.version = nextVersion
        const payload: SkillTree = toSerializableSkillTree({
          ...this.skillTreeData,
          id: this.currentTreeId,
          updatedAt: new Date().toISOString(),
          version: nextVersion,
        })
        const saved = await saveSkillTreeToSW(payload)
        this.skillTreeData = normalizeSkillTree(saved, defaultSkillTree)
        this.currentTreeId = this.skillTreeData.id
        this.skillTreeUpdatedAt = this.skillTreeData.updatedAt
      } catch (error) {
        console.error('スキルツリーの保存に失敗しました', error)
      }
    },
    /**
     * 処理名: スキルツリーエクスポート
     *
     * 処理概要: 接続を正規化してAPIからデータを取得し、Blob経由でクライアントにダウンロードさせる。
     *
     * 実装理由: 編集済みデータのバックアップや共有を容易にするため。
     */
    async exportSkillTree() {
      try {
        this.refreshConnections()
        const normalized = await exportSkillTreeFromSW(this.currentTreeId)
        const blob = new Blob([JSON.stringify(normalized, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${normalized.id || 'skill-tree'}.json`
        anchor.click()
        URL.revokeObjectURL(url)
      } catch (error) {
        console.error('スキルツリーのエクスポートに失敗しました', error)
      }
    },
    async exportSkillTreeById(treeId: string) {
      try {
        const normalized = await exportSkillTreeFromSW(treeId)
        const blob = new Blob([JSON.stringify(normalized, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${normalized.id || 'skill-tree'}.json`
        anchor.click()
        URL.revokeObjectURL(url)
      } catch (error) {
        console.error('スキルツリーのエクスポートに失敗しました', error)
      }
    },
    /**
     * 処理名: スキルツリーインポート
     *
     * 処理概要: ファイルからJSONを読み込み正規化し、APIへ送信して状態を置き換える。
     *
     * 実装理由: 外部からのツリー差し替えやテンプレート読込を可能にするため。
     */
    async importSkillTreeFromFile(file: File) {
      try {
        const content = await file.text()
        const parsed = JSON.parse(content)
        const normalized = normalizeSkillTree(parsed, defaultSkillTree)
        await this.applyImportedSkillTree(normalized)
      } catch (error) {
        console.error('スキルツリーのインポートに失敗しました', error)
        throw error
      }
    },
    async importSkillTreeFromUrl(url: string) {
      try {
        const trimmed = url?.trim()
        if (!trimmed) {
          throw new Error('インポートするURLを入力してください')
        }

        const response = await fetch(trimmed)
        if (!response.ok) {
          throw new Error(`スキルツリーの取得に失敗しました (${response.status})`)
        }
        const parsed = await response.json()
        const etag = response.headers.get('etag') ?? undefined
        const normalized = normalizeSkillTree({ ...parsed, sourceUrl: trimmed, sourceEtag: etag }, defaultSkillTree)
        await this.applyImportedSkillTree(normalized)
      } catch (error) {
        console.error('スキルツリーのインポートに失敗しました', error)
        throw error
      }
    },
    /**
     * 処理名: 編集モード切替
     *
     * 処理概要: 編集モードのオンオフを切り替え、終了時に保存と選択解除を行う。
     *
     * 実装理由: 閲覧と編集のモードを明確に分け、編集内容を確実に永続化するため。
     */
    async toggleEditMode() {
      this.editMode = !this.editMode

      if (!this.editMode) {
        await this.saveSkillTree()
        this.clearSelection()
      }
    },
    async activateSkillTree(treeId: string) {
      const targetId = treeId?.trim() || defaultSkillTree.id
      await this.loadSkillTree(targetId)
      await this.loadStatus(targetId)
      this.clearSelection()
      // UI表示後に最新ソースをバックグラウンド確認
      void this.refreshFromSourceUrl()
    },
    /**
     * 処理名: ステータス読込
     *
     * 処理概要: APIから残ポイントとアンロックスキルIDを取得し、正規化して状態に反映する。
     *
     * 実装理由: サーバーとクライアントのステータスを同期させるため。
     */
    async loadStatus(treeId?: string) {
      this.loading = true
      const targetTreeId = treeId?.trim() || this.currentTreeId || defaultSkillTree.id
      try {
        await ensureServiceWorker()
        const status = await getStatusFromSW(targetTreeId)
        this.availablePoints = status.availablePoints
        this.unlockedSkillIds = status.unlockedSkillIds
        this.statusUpdatedAt = status.updatedAt
        this.setupSyncListener()
      } catch (error) {
        console.error('ステータスの取得に失敗しました', error)
        const fallback = normalizeStatus(targetTreeId)
        this.availablePoints = fallback.availablePoints
        this.unlockedSkillIds = fallback.unlockedSkillIds
        this.statusUpdatedAt = fallback.updatedAt
      } finally {
        this.loading = false
      }
    },
    /**
     * 処理名: 進行状況保存
     *
     * 処理概要: 現在の残ポイントとアンロックスキルIDをAPIへ送信し保存する。
     *
     * 実装理由: ユーザー進行を手動保存できるようにするため。
     */
    async saveProgress() {
      try {
        await ensureServiceWorker()
        const status: SkillStatus = {
          treeId: this.currentTreeId,
          availablePoints: this.availablePoints,
          unlockedSkillIds: this.unlockedSkillIds,
          updatedAt: new Date().toISOString(),
        }
        const saved = await saveStatusToSW(toSerializableStatus(status))
        this.availablePoints = saved.availablePoints
        this.unlockedSkillIds = saved.unlockedSkillIds
        this.statusUpdatedAt = saved.updatedAt
      } catch (error) {
        console.error('進行状況の保存に失敗しました', error)
      }
    },
    async deleteSkillTree(treeId: string) {
      const targetId = treeId?.trim()
      if (!targetId) {
        return { ok: false, message: 'スキルツリーIDが不正です' }
      }

      try {
        await ensureServiceWorker()
        await deleteSkillTreeFromSW(targetId)
        if (this.currentTreeId === targetId) {
          this.clearSelection()
          await this.activateSkillTree(defaultSkillTree.id)
        }
        await this.fetchSkillTreeCollection()
        return { ok: true }
      } catch (error) {
        console.error('スキルツリーの削除に失敗しました', error)
        return { ok: false, message: 'スキルツリーの削除に失敗しました' }
      }
    },
    async refreshFromSourceUrl() {
      const sourceUrl = this.skillTreeData.sourceUrl?.trim()
      if (!sourceUrl) return

      try {
        const headers: Record<string, string> = {}
        const etag = this.skillTreeData.sourceEtag?.trim()
        if (etag) headers['If-None-Match'] = etag

        const response = await fetch(sourceUrl, { headers })
        if (response.status === 304) return
        if (!response.ok) return

        const parsed = await response.json()
        const nextEtag = response.headers.get('etag') ?? undefined
        const normalized = normalizeSkillTree({ ...parsed, sourceUrl, sourceEtag: nextEtag }, defaultSkillTree)
        const incomingTime = new Date(normalized.updatedAt).getTime()
        const currentTime = new Date(this.skillTreeData.updatedAt).getTime()
        if (!Number.isFinite(incomingTime) || incomingTime <= currentTime) return

        await this.applyImportedSkillTree(normalized)
      } catch (error) {
        console.error('ソースURLからの更新確認に失敗しました', error)
      }
    },
  },
})
